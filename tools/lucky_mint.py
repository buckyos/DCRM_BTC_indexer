import requests
import json
import argparse
from datetime import datetime
import pytz
import json

class BTCClient:
    def __init__(self, host, network, auth):
        self.url = host
        self.headers = {'content-type': 'application/json'}
        self.auth = auth
        self.network = network

    def get_latest_block_height(self):
        payload = {
            "method": "getblockcount",
            "params": [],
            "jsonrpc": "2.0",
            "id": 0,
        }
        response = requests.post(self.url, data=json.dumps(payload), headers=self.headers, auth=self.auth)
        return response.json()['result']

    def get_block(self, height):
        block_hash = self._get_block_hash(height)
        payload = {
            "method": "getblock",
            "params": [block_hash],
            "jsonrpc": "2.0",
            "id": 0,
        }
        response = requests.post(self.url, data=json.dumps(payload), headers=self.headers, auth=self.auth)
        return response.json()['result']

    def _get_block_hash(self, height):
        payload = {
            "method": "getblockhash",
            "params": [height],
            "jsonrpc": "2.0",
            "id": 0,
        }
        response = requests.post(self.url, data=json.dumps(payload), headers=self.headers, auth=self.auth)
        return response.json()['result']

    def get_latest_block_info(self):
        height = self.get_latest_block_height()
        block = self.get_block(height)
        return {
            'height': block['height'],
            'timestamp': block['time']
        }
        
# get latest block info from blockchain.info
class BlockchainInfoClient:
    def __init__(self):
        self.url = 'https://blockchain.info/latestblock'

    def get_latest_block(self):
        response = requests.get(self.url)
        return response.json()

    
    def get_latest_block_info(self):
        """
        This function returns the latest block info from blockchain.info
        
        Returns:
            dict: a dict that contains the latest block height and timestamp
        """
        block = self.get_latest_block()
        return {
            'height': block['height'],
            'timestamp': block['time']
        }
        
class Util:
    @staticmethod
    def address_number(address):
        assert isinstance(address, str), f"address should be string {address}"
        assert len(address) >= 8, f"address length should >= 8 {address}"

        address_type = Util.get_btc_address_type(address)
        if address_type == 'bech32':
            address = address.lower()

        return Util._calc_string_number(address)

    @staticmethod
    def _calc_string_number(s):
        s = s.strip()
        assert isinstance(s, str), f"str should be string {s}"
        assert len(s) >= 8, f"string length should >= 8 {s}"

        sum = 0
        for i in range(8):
            sum += ord(s[len(s) - 1 - i])

        return sum

    @staticmethod
    def get_btc_address_type(address):
        assert isinstance(address, str), f"address should be string {address}"
        address = address.strip().lower()

        if address.startswith('1'):
            return 'legacy'
        elif address.startswith('3'):
            return 'segwit'
        elif address.startswith('bc1'):
            return 'bech32'
        else:
            print(f"unknown address type {address}")
            return 'unknown'

class LuckyMintHelper:
    def __init__(self, config, timezone):
        assert isinstance(config, dict), f"config should be object, but {config}"
        assert timezone == None or isinstance(timezone, str), f"timezone should be string, but {timezone}"

        '''
        # local btc node if you have one
        self.btc_client = BTCClient(
            config['btc']['host'],
            config['btc']['network'],
            config['btc']['auth'],
        )
        '''
        
        self.btc_client = BlockchainInfoClient()
        self.timezone = timezone

        self.lucky_mint_block_threshold = config['token']['difficulty']['lucky_mint_block_threshold']
        assert isinstance(self.lucky_mint_block_threshold, int)

    def convert_timestamp(self, timestamp):
        if self.timezone == None:
            date = datetime.fromtimestamp(timestamp)
        else:
            date = datetime.utcfromtimestamp(timestamp)
            tz = pytz.timezone(self.timezone)
            date = date.replace(tzinfo=pytz.utc).astimezone(tz)

        return date.strftime('%Y-%m-%d %H:%M:%S %Z%z')

    def next_n_lucky_mint(self, address, n):
        assert isinstance(address, str), f"address should be string, but {address}"
        assert isinstance(n, int), f"n should be number, but {n}"
        assert n > 0, f"n should be greater than 0, but {n}"

        # load latest block info
        block = self.btc_client.get_latest_block_info()
        block_height = block['height']
        
        print(f"address: {address}")
        print(f"current lucky mint block threshold: {self.lucky_mint_block_threshold}")
        print(f"current block height: {block_height}")

        timestamp = block['timestamp']
        print(f"current block timestamp: {timestamp}, {self.convert_timestamp(timestamp)}")
        begin_timestamp = timestamp

        lucky_mint_block_height_list = []
        i = 1

        while True:
            lucky_mint_block_height = block_height + i
            lucky_mint_block_timestamp = begin_timestamp + 60 * 12 * i

            if self.is_lucky_mint(address, lucky_mint_block_height):
                timestamp_str = self.convert_timestamp(lucky_mint_block_timestamp)
                lucky_mint_block_height_list.append({
                    'block_height': lucky_mint_block_height,
                    'timestamp': lucky_mint_block_timestamp,
                    'timestamp_str': timestamp_str,
                })

            if len(lucky_mint_block_height_list) >= n:
                break

            i += 1

        return lucky_mint_block_height_list

    def is_lucky_mint(self, address, block_height):
        assert isinstance(address, str), f"address should be string, but {address}"
        assert isinstance(block_height, int), f"block_height should be number, but {block_height}"

        address_num = Util.address_number(address)

        if (block_height + address_num) % self.lucky_mint_block_threshold == 0:
            return True
        else:
            return False

DEFAULT_CONFIG = {
    'btc': {
        'host': 'http://localhost:8332',
        'network': 'mainnet',
        'auth': ('user', 'password')
    },
    'token': {
        'difficulty': {
            'lucky_mint_block_threshold': 8,
        }
    }
}

def main():
    parser = argparse.ArgumentParser(description='Lucky Mint Helper')
    parser.add_argument('--address', type=str, help='User BTC address', required=True)
    parser.add_argument('--n', type=int, default=5, help='Number of lucky mint, default is 5')
    parser.add_argument('--timezone', type=str, default=None, help=f"Timezone, default is current timezone")
    args = parser.parse_args()

    config = DEFAULT_CONFIG
    
    lucky_mint_helper = LuckyMintHelper(config, args.timezone)
    lucky_mints = lucky_mint_helper.next_n_lucky_mint(args.address, args.n)

    lucky_mints = json.dumps(lucky_mints, indent=4)
    print(f"Next {args.n} lucky mints: {lucky_mints}")

if __name__ == "__main__":
    main()
