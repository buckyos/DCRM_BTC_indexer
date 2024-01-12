const { TokenIndexStorage } = require('../storage/token');
const { UserHashRelationStorage } = require('../storage/relation');
const assert = require('assert');

class ResonanceVerifier {
    constructor(storage) {
        assert(
            storage instanceof TokenIndexStorage,
            'storage should be TokenIndexStorage',
        );

        this.storage = storage;
        this.relation_storage = storage.get_user_hash_relation_storage();
        assert(
            this.relation_storage instanceof UserHashRelationStorage,
            'relation_storage should be UserHashRelationStorage',
        );
    }

    /**
     * @comment verify user resonance, if user has no chant at 12800 consecutive blocks, will loses its resonance right
     * @param {string} address
     * @param {number} block_height
     * @returns {Promise<{ret: number}>}
     */
    async verify_user(address, block_height) {
        assert(_.isString(address), `address should be string ${address}`);
        assert(_.isNumber(block_height), `block_height should be number ${block_height}`);

        // If the use has not any chant 12,800 consecutive blocks, will loses its resonance right
        const { ret: get_last_chant_ret, data: last_chant_data } =
            await this.storage.get_user_last_chant(address);
        if (get_last_chant_ret !== 0) {
            console.error(`get_user_last_chant failed ${address}`);
            return { ret: get_last_chant_ret };
        }

        let changed = false;
        if (last_chant_data != null) {
            if (last_chant_data.block_height + 12800 < block_height) {
                console.warn(
                    `user ${address} has no chant at 12800 consecutive blocks, last chant block number ${last_chant_data.block_height}, current block number ${block_height}`,
                );

                // clear user all resonance
                const { ret: clear_ret } =
                    await this.relation_storage.clear_user_all_resonances(
                        address,
                    );
                if (clear_ret !== 0) {
                    console.error(
                        `failed to clear user all resonance ${address}`,
                    );
                    return { ret: clear_ret };
                }

                changed = true;
            }
        } else {
            // user has no chant at any block
            // TODO: should we check for this case?
        }

        return { ret: 0, changed };
    }

    /**
     * @comment verify hash's all user resonance, if user has no chant at 12800 consecutive blocks, will loses its resonance right for this hash
     * @param {string} hash
     * @param {number} block_height
     * @returns {Promise<{ret: number, changed: boolean}>}
     */
    async verify_hash(hash, block_height) {
        assert(_.isString(hash), `hash should be string ${hash}`);
        assert(_.isNumber(block_height), `block_height should be number ${block_height}`);

        // first get hash all resonance list
        const { ret: get_ret, data: resonance_list } =
            await this.relation_storage.get_resonances_by_hash(hash);
        if (get_ret !== 0) {
            console.error(`failed to get hash all resonance ${hash}`);
            return { ret: get_ret };
        }

        // check if hash has any resonance
        if (resonance_list.length === 0) {
            // no resonance, so we should ignore this hash
            return { ret: 0 };
        }

        // check if hash has any user that resonance at 12800 consecutive blocks
        let valid_resonance_count = 0;
        for (const resonance of resonance_list) {
            assert(
                _.isString(resonance.address),
                `invalid address: ${resonance.address}`,
            );

            const { ret: verify_ret, changed } = await this.verify_user(
                resonance.address,
                block_height,
            );
            if (verify_ret !== 0) {
                console.error(`failed to verify user ${resonance.address}`);
                return { ret: verify_ret };
            }

            if (!changed) {
                valid_resonance_count += 1;
            }
        }

        // update hash resonance count if changed
        let changed = false;
        if (valid_resonance_count < resonance_list.length) {
            console.log(
                `hash ${hash} has ${
                    resonance_list.length - valid_resonance_count
                } resonance lost`,
            );
            const { ret } = await this.storage.reset_resonance_count(
                hash,
                valid_resonance_count,
            );
            if (ret !== 0) {
                console.error(
                    `failed to reset_resonance_count ${hash} ${valid_resonance_count}`,
                );
                return { ret };
            }

            changed = true;
        }

        return { ret: 0, changed };
    }
}

module.exports = { ResonanceVerifier };
