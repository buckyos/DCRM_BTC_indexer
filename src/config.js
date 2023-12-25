
class Config {
    constructor(config_file) {
        this.config_file = config_file;
        console.info(`Loading config file: ${config_file}`);

        this.config = require(config_file);
        console.log(this.config);
    }
}

module.exports = { Config };