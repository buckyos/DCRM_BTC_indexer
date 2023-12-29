const axios = require('axios');
const assert = require('assert');

class OrdClient {
    constructor(server_url) {
        assert(_.isString(server_url), `server_url should be string`);

        this.server_url = server_url;
        this.client = axios.create({
            baseURL: this.server_url,
            headers: {
                Accept: 'application/json',
            },
        });
    }

    /**
     *
     * @param {string} inscription_id
     * @returns {Promise<{ret: number, inscription: object}>}
     */
    async get_inscription(inscription_id) {
        try {
            const response = await this.client.get(
                `/inscription/${inscription_id}`,
            );
            return {
                ret: 0,
                inscription: response.data,
            };
        } catch (error) {
            console.error(error);
            return {
                ret: -1,
                inscription: {},
            };
        }
    }

    async get_inscription_by_block(block_height) {
        try {
            const response = await this.client.get(
                `/inscriptions/block/${block_height}`,
            );
            return {
                ret: 0,
                data: response.data,
            };
        } catch (error) {
            console.error(error);
            return {
                ret: -1,
                data: {},
            };
        }
    }

    async get_content_by_inscription(inscription_id) {
        try {
            const response = await this.client.get(
                `/content/${inscription_id}`,
            );
            return {
                ret: 0,
                data: response.data,
            };
        } catch (error) {
            console.error(error);
            return {
                ret: -1,
                data: {},
            };
        }
    }

    async get_output_by_outpoint(outpoint) {
        try {
            const response = await this.client.get(`/output/${outpoint}`);
            return {
                ret: 0,
                data: response.data,
            };
        } catch (error) {
            console.error(`failed to get output ${outpoint}`, error);
            return {
                ret: -1,
                data: {},
            };
        }
    }
}

module.exports = { OrdClient };
