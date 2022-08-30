/**
 * Error thrown when a Formula can not be computed
 */
export class UncomputableError extends Error {
    /**
     * UncomputableError constructor
     * @param {string} message Error message
     * @param {string} key The key that could not be computed
     * @param {string} formula The full formula
     * @param {Object} props The props at computation time
     */
    constructor(message, key, formula, props) {
        super(message);

        this.key = key;
        this.formula = formula;
        this.props = props;
    }
}
