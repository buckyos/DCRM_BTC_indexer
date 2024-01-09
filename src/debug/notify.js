const assert = require('assert');
const { BugHandler } = require('./bug_handler.js');
const axios = require('axios');

class PostNotifier extends BugHandler {
    constructor(notify_url) {
        super();

        assert(_.isString(notify_url), `invalid notify_url: ${notify_url}`);

        this.notify_url = notify_url;
    }

    handle(content) {
        const notify_msg = {
            msgtype: 'text',
            text: {
                content: content,
            },
            at: {
                atMobiles: [],
                isAtAll: false,
            },
        };

        // post to notify_url
        axios
            .post(this.notify_url, notify_msg, {
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            .then((response) => {
                console.log(`notify response: ${response}`);
            })
            .catch((error) => {
                console.error(`failed to notify: ${error}`);
            });
    }
}

module.exports = {
    PostNotifier,
};
