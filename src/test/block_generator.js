class BlockGenerator {
    constructor() {
        if (new.target === BlockGenerator) {
            throw new TypeError(
                'Cannot construct BlockGenerator instances directly',
            );
        }
    }

    // eslint-disable-next-line require-yield
    *generatorFunction() {
        throw new Error('Must override method');
    }

    next() {
        return this.generator.next();
    }
}

class FixedBlockGenerator extends BlockGenerator {
    constructor(blockHeights) {
        super();
        this.blockHeights = blockHeights;
        this.generator = this.generatorFunction();
    }

    *generatorFunction() {
        for (let height of this.blockHeights) {
            yield height;
        }
    }
}

class RangeBlockGenerator extends BlockGenerator {
    constructor(range) {
        super();
        this.range = range;
        this.generator = this.generatorFunction();
    }

    *generatorFunction() {
        for (let i = this.range[0]; i <= this.range[1]; i++) {
            yield i;
        }
    }
}


module.exports = {
    BlockGenerator,
    FixedBlockGenerator,
    RangeBlockGenerator,
};