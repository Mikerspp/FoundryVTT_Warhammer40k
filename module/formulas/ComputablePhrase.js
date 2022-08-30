import Formula from './Formula.js';
import { postAugmentedChatMessage } from '../utils.js';

/**
 * Class holding computed phrase details, for explanation
 */
class ComputablePhrase {
    /**
     * The initial phrase to be computed
     * @type {string}
     * @private
     */
    _rawPhrase;

    /**
     * The built phrase with every inner formula replaced with a unique identifier
     * @type {string}
     * @private
     */
    _buildPhrase;

    /**
     * All the inner formulas computed, assigned with a unique identifier
     * @type {Object<Formula>}
     * @private
     */
    _computedFormulas = {};

    /**
     * Constructs new ComputablePhrase with a phrase to compute
     * @param {string} phrase The phrase to compute
     */
    constructor(phrase) {
        this._rawPhrase = phrase;
    }

    /**
     * Gets the raw formula
     * @returns {string}
     */
    get formula() {
        let phrase = this._buildPhrase;
        for (let key in this._computedFormulas) {
            phrase = phrase.replaceAll(key, this._computedFormulas[key].raw);
        }

        return phrase;
    }

    /**
     * Gets the computed formula, i.e. the raw formula with all token replaced by their parsed values
     * @returns {string}
     */
    get parsed() {
        let phrase = this._buildPhrase;
        for (let key in this._computedFormulas) {
            phrase = phrase.replaceAll(key, this._computedFormulas[key].parsed);
        }

        return phrase;
    }

    /**
     * Gets the phrase ready for replacements
     * @returns {string}
     */
    get buildPhrase() {
        return this._buildPhrase;
    }

    /**
     * Gets the resulting phrase, i.e. the fully computed values
     * @returns {string}
     */
    get result() {
        let phrase = this._buildPhrase;
        for (let key in this._computedFormulas) {
            phrase = phrase.replaceAll(key, this._computedFormulas[key].result);
        }

        return phrase;
    }

    /**
     * Gets the computed formulas of the phrase, for building purposes
     * @return {Object<Formula>}
     */
    get values() {
        return this._computedFormulas;
    }

    /**
     * Posts phrase as a Chat Message
     * @param options
     */
    postMessage(options) {
        postAugmentedChatMessage(this, options);
    }

    /**
     * Computes everything in the phrase, including dynamic data such as rolls and user inputs
     * @param {Object} props Property object used for variable replacing in the formula
     * @param {Object} [options]
     * @param {string|null} [options.reference] Reference used in case of dynamic table field syntax
     * @param {string|null} [options.defaultValue] Default value used in case a variable is not present in props. If null, computation will throw an UncomputableError if a value is not found.
     * @param {boolean} [options.computeExplanation=false] Indicates whether to compute Formula explanation
     * @return {ComputablePhrase} This phrase
     * @throws {UncomputableError} If a variable can not be computed
     */
    async compute(props, options = {}) {
        console.debug('Computing ' + this._rawPhrase);

        let phrase = this._rawPhrase;

        let localVars = {};

        let computedFormulas = {};
        let nComputed = 0;

        // Get every formula in the phrase. Formulas are surrounded by ${ and }$ for easy delimitation
        let formulaIterator = phrase.matchAll(/\${.*?}\$/g);
        let textFormula = formulaIterator.next();
        while (!textFormula.done) {
            let formula = new Formula(textFormula.value[0].substring(2).slice(0, -2));

            await formula.compute(props, {
                localVars,
                ...options
            });

            // Saves formula data
            let computedId = 'form' + nComputed;
            computedFormulas[computedId] = formula;

            phrase = phrase.replace(textFormula.value[0], computedId);

            localVars = {
                ...localVars,
                ...formula.localVars
            };

            nComputed++;
            textFormula = formulaIterator.next();
        }

        this._buildPhrase = phrase;
        this._computedFormulas = computedFormulas;

        return this;
    }

    /**
     * Computes the phrase without any dynamic data such as rolls and user inputs. If rolls or user inputs syntax are present, will throw an error.
     * @param {Object} props Property object used for variable replacing in the formula
     * @param {Object} [options]
     * @param {string|null} [options.reference] Reference used in case of dynamic table field syntax
     * @param {string|null} [options.defaultValue] Default value used in case the variable is not present in props. If null, computation will throw an UncomputableError if a value is not found.
     * @param {boolean} [options.computeExplanation=false] Indicates whether to compute Formula explanation
     * @return {ComputablePhrase} This phrase
     * @throws {UncomputableError} If a variable can not be computed
     */
    computeStatic(props, options = {}) {
        console.debug('Computing ' + this._rawPhrase);

        let phrase = this._rawPhrase;

        let localVars = {};

        let computedFormulas = {};
        let nComputed = 0;

        // Get every formula in the phrase. Formulas are surrounded by ${ and }$ for easy delimitation
        let formulaIterator = phrase.matchAll(/\${.*?}\$/g);
        let textFormula = formulaIterator.next();
        while (!textFormula.done) {
            let formula = new Formula(textFormula.value[0].substring(2).slice(0, -2));

            formula.computeStatic(props, {
                localVars,
                ...options
            });

            // Saves formula data
            let computedId = 'form' + nComputed;
            computedFormulas[computedId] = formula;

            phrase = phrase.replace(textFormula.value[0], computedId);

            localVars = {
                ...localVars,
                ...formula.localVars
            };

            nComputed++;
            textFormula = formulaIterator.next();
        }

        this._buildPhrase = phrase;
        this._computedFormulas = computedFormulas;

        return this;
    }

    /**
     * Computes a phrase, including dynamic data such as rolls and user inputs
     * @param {string} phrase The phrase to compute
     * @param {Object} props Property object used for variable replacing in the formula
     * @param {Object} [options]
     * @param {string|null} [options.reference] Reference used in case of dynamic table field syntax
     * @param {string|null} [options.defaultValue] Default value used in case the variable is not present in props. If null, computation will throw an UncomputableError if a value is not found.
     * @return {ComputablePhrase} The computed phrase
     * @throws {UncomputableError} If a variable can not be computed
     */
    static async computeMessage(phrase, props, options = {}) {
        let computablePhrase = new ComputablePhrase(phrase);
        await computablePhrase.compute(props, options);

        return computablePhrase;
    }

    /**
     * Computes a phrase without any dynamic data such as rolls and user inputs. If rolls or user inputs syntax are present, will throw an error.
     * @param {string} phrase The phrase to compute
     * @param {Object} props Property object used for variable replacing in the formula
     * @param {Object} options
     * @param {string|null} [options.reference] Reference used in case of dynamic table field syntax
     * @param {string|null} [options.defaultValue] Default value used in case the variable is not present in props. If null, computation will throw an UncomputableError if a value is not found.
     * @return {ComputablePhrase} The computed phrase
     * @throws {UncomputableError} If a variable can not be computed
     */
    static computeMessageStatic(phrase, props, options = {}) {
        let computablePhrase = new ComputablePhrase(phrase);
        computablePhrase.computeStatic(props, options);

        return computablePhrase;
    }

    /**
     * Returns the fully computed phrase as a string
     * @return {string}
     */
    toString() {
        return this.result;
    }
}

globalThis.ComputablePhrase = ComputablePhrase;
