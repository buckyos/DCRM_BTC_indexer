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

    static new_from_config(config) {
        assert(_.isObject(config), `invalid config: ${config}`);

        return new OrdClient(config.ord.rpc_url);
    }

    /**
     * @command check if response is successful by status code
     * @param {object} response
     * @returns {boolean}
     */
    _is_successful_response(response) {
        return response.status >= 200 && response.status < 300;
    }

    /**
     * @command get the latest block height for ord service
     */
    async get_latest_block_height() {
        try {
            const response = await this.client.get('/blockheight');
            if (!this._is_successful_response(response)) {
                console.error(
                    `failed to get ord latest block height ${response.status}`,
                );
                return {
                    ret: -1,
                    height: 0,
                };
            }

            return {
                ret: 0,
                height: response.data,
            };
        } catch (error) {
            console.error(`failed to get ord latest block height ${error}`);
            return {
                ret: -1,
                height: 0,
            };
        }
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
            if (!this._is_successful_response(response)) {
                console.error(
                    `failed to get inscription ${inscription_id} ${response.status}`,
                );
                return {
                    ret: -1,
                };
            }

            return {
                ret: 0,
                inscription: response.data,
            };
        } catch (error) {
            console.error(
                `failed to get inscription ${inscription_id} ${error}`,
            );
            return {
                ret: -1,
            };
        }
    }

    /**
     *
     * @param {Array<string>} inscription_ids
     * @returns {Promise<{ret: number, inscriptions: Array<object>}>}
     */
    async get_inscription_batch(inscription_ids) {
        // call _get_inscription_batch in 64 batch
        const batch_size = 64;
        const inscriptions = [];
        for (let i = 0; i < inscription_ids.length; i += batch_size) {
            let end = i + batch_size;
            if (end > inscription_ids.length) {
                end = inscription_ids.length;
            }

            const batch_inscription_ids = inscription_ids.slice(i, end);
            const { ret, inscriptions: batch_inscriptions } =
                await this._get_inscription_batch(batch_inscription_ids);
            if (ret !== 0) {
                return { ret };
            }

            inscriptions.push(...batch_inscriptions);
        }

        assert(
            inscription_ids.length === inscriptions.length,
            `invalid inscriptions length: ${inscriptions.length} !== ${inscription_ids.length}`,
        );

        // verify the order
        for (let i = 0; i < inscriptions.length; i++) {
            const inscription = inscriptions[i];
            assert(
                inscription.inscription_id === inscription_ids[i],
                `invalid inscription id ${inscription.inscription_id} !== ${inscription_ids[i]}`,
            );
        }

        return { ret: 0, inscriptions };
    }

    /**
     *
     * @param {Array<string>} inscription_ids
     * @returns {Promise<{ret: number, inscriptions: Array<object>}>}
     */
    async _get_inscription_batch(inscription_ids) {
        assert(_.isArray(inscription_ids), `inscription_ids should be array`);
        assert(
            inscription_ids.length > 0,
            `inscription_ids should not be empty`,
        );

        // get all inscriptions use get_inscription
        const promises = inscription_ids.map((inscription_id) =>
            this.client.get(`/inscription/${inscription_id}`),
        );

        try {
            const responses = await Promise.all(promises);

            // check all responses
            const inscriptions = [];
            for (let i = 0; i < responses.length; i++) {
                const response = responses[i];
                if (!this._is_successful_response(response)) {
                    console.error(
                        `failed to get inscription ${inscription_ids[i]} ${response.status}`,
                    );
                    return {
                        ret: -1,
                    };
                }

                inscriptions.push(response.data);
            }

            return {
                ret: 0,
                inscriptions,
            };
        } catch (error) {
            console.error(`failed to get inscriptions ${error}`);
            return {
                ret: -1,
            };
        }
    }

    /**
     *
     * @param {number} block_height
     * @returns {Promise<{ret: number, data: object}>}
     */
    async get_inscription_by_block(block_height) {
        try {
            // get by pages
            let page = 0;
            let inscriptions = [];

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const response = await this.client.get(
                    `/inscriptions/block/${block_height}/${page}`,
                );
                if (!this._is_successful_response(response)) {
                    console.error(
                        `failed to get inscriptions by block ${block_height} ${page} ${response.status}`,
                    );
                    return {
                        ret: -1,
                    };
                }

                inscriptions = inscriptions.concat(response.data.inscriptions);
                if (!response.data.more) {
                    break;
                }

                page++;
            }

            return {
                ret: 0,
                data: inscriptions,
            };
        } catch (error) {
            console.error(`failed to get inscriptions by block ${error}`);
            return {
                ret: -1,
            };
        }
    }

    async get_content_by_inscription(inscription_id) {
        try {
            const response = await this.client.get(
                `/content/${inscription_id}`,
            );

            if (!this._is_successful_response(response)) {
                console.error(
                    `failed to get content ${inscription_id} ${response.status}`,
                );
                return {
                    ret: -1,
                };
            }

            return {
                ret: 0,
                data: response.data,
            };
        } catch (error) {
            if (error.response.status === 404) {
                console.warn(`get content but not found ${inscription_id}`);
                return {
                    ret: 0,
                    data: null,
                };
            } else if (error.response.status >= 200 && error.response.status < 300) {
                // FIXME something wrong with the inscription, such as invalid content, like this one: 08770f28ab15ec0acf1103ce6af34c57c05ba7db5df783b3b75058725e0bd480i0
                console.warn(`get content with status ok but invalid content ${inscription_id} ${error.response.status} ${error}`);
                return {
                    ret: 0,
                    data: null,
                };
            }

            console.error(`failed to get content ${inscription_id} ${error}`);
            return {
                ret: -1,
            };
        }
    }

    async get_output_by_outpoint(outpoint) {
        try {
            const response = await this.client.get(`/output/${outpoint}`);
            if (!this._is_successful_response(response)) {
                console.error(
                    `failed to get output ${outpoint} ${response.status}`,
                );
                return {
                    ret: -1,
                };
            }

            return {
                ret: 0,
                data: response.data,
            };
        } catch (error) {
            console.error(`failed to get output ${outpoint}`, error);
            return {
                ret: -1,
            };
        }
    }
}

module.exports = { OrdClient };
