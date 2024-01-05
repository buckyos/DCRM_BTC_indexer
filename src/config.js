const path = require('path');
const fs = require('fs');
const assert = require('assert');
const {
    DIFFICULTY_INSCRIBE_DATA_HASH_THRESHOLD,
    DIFFICULTY_INSCRIBE_LUCKY_MINT_BLOCK_THRESHOLD,
    DIFFICULTY_CHANT_BLOCK_THRESHOLD,
} = require('./constants');

class Config {
    constructor(config_file) {
        this.config_file = config_file;
        console.info(`Loading config file: ${config_file}`);

        this.config = require(config_file);

        assert(this.config.isolate, `isolate should be set`);
        assert(this.config.eth.contract_abi, `contract_abi should be set`);

        console.log(JSON.stringify(this.config));

        // load abi file from config file in the same dir
        const abi_file = path.join(
            path.dirname(config_file),
            this.config.eth.contract_abi,
        );
        assert(fs.existsSync(abi_file));
        this.config.eth.contract_abi = require(abi_file);


        const lucky_mint_abi_file = path.join(
            path.dirname(config_file),
            this.config.eth.lucky_mint_contract_abi,
        );
        assert(fs.existsSync(lucky_mint_abi_file));
        this.config.eth.lucky_mint_contract_abi = require(lucky_mint_abi_file);


        // check the difficulty and give warning if changed
        if (this.config.token.difficulty.inscribe_data_hash_threshold != null) {
            if (
                this.config.token.difficulty.inscribe_data_hash_threshold !==
                DIFFICULTY_INSCRIBE_DATA_HASH_THRESHOLD
            ) {
                console.warn(
                    `<<<<WARN>>>> difficulty.inscribe_data_hash_threshold changed! ${DIFFICULTY_INSCRIBE_DATA_HASH_THRESHOLD} -> ${this.config.token.difficulty.inscribe_data_hash_threshold}`,
                );
            }
        }

        if (this.config.token.difficulty.lucky_mint_block_threshold != null) {
            if (
                this.config.token.difficulty.lucky_mint_block_threshold !==
                DIFFICULTY_INSCRIBE_LUCKY_MINT_BLOCK_THRESHOLD
            ) {
                console.warn(
                    `<<<<WARN>>>> difficulty.lucky_mint_block_threshold changed! ${DIFFICULTY_INSCRIBE_LUCKY_MINT_BLOCK_THRESHOLD} -> ${this.config.token.difficulty.lucky_mint_block_threshold}`,
                );
            }
        }

        if (this.config.token.difficulty.chant_block_threshold != null) {
            if (
                this.config.token.difficulty.chant_block_threshold !==
                DIFFICULTY_CHANT_BLOCK_THRESHOLD
            ) {
                console.warn(
                    `<<<<WARN>>>> difficulty.chant_block_threshold changed! ${DIFFICULTY_CHANT_BLOCK_THRESHOLD} -> ${this.config.token.difficulty.chant_block_threshold}`,
                );
            }
        }
    }
}

module.exports = { Config };
