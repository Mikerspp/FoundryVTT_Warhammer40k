import { UncomputableError } from '../errors/errors.js';

/**
 * Class holding formula details, for explanation
 */
class Formula {
    /**
     * The raw uncomputed formula
     * @type {string}
     * @private
     */
    _raw;

    /**
     * The formula's computed result
     * @type {string}
     * @private
     */
    _result;

    /**
     * Local variables used in the formula's computing
     * @type {Object}
     * @private
     */
    _localVars;

    /**
     * The parsed version of the formulas, with needed replacements of tokens with unique identifiers
     * @type {string}
     * @private
     */
    _parsed;

    /**
     * Indicates if the formula contains dice rolls
     * @type {boolean}
     * @private
     */
    _hasDice;

    /**
     * All formulas computed variables, except for rolls
     * @type {Array<Object>}
     * @private
     */
    _tokens;

    /**
     * Formula computed rolls
     * @type {Object<Roll>}
     * @private
     */
    _rolls;

    /**
     * Indicates if formula should be hidden from players
     * @type {boolean}
     * @private
     */
    _hidden = false;

    /**
     * Indicates if formula should be explained
     * @type {boolean}
     * @private
     */
    _explanation = true;

    /**
     * Construct a new formula from a string
     * @param {string} formula The formula to compute
     */
    constructor(formula) {
        this._raw = formula;
    }

    /**
     * The raw uncomputed formula
     * @return {string}
     */
    get raw() {
        return this._raw;
    }

    /**
     * The formula's computed result
     * @return {string}
     */
    get result() {
        return this._result;
    }

    /**
     * Local variables used in the formula's computing
     * @return {Object}
     */
    get localVars() {
        return this._localVars;
    }

    /**
     * The parsed version of the formulas, with needed replacements of tokens with unique identifiers
     * @return {string}
     */
    get parsed() {
        return this._parsed;
    }

    /**
     * Indicates if the formula contains dice rolls
     * @return {boolean}
     */
    get hasDice() {
        return this._hasDice;
    }

    /**
     * All formulas computed variables, except for rolls
     * @return {Array<Object>}
     */
    get tokens() {
        return this._tokens;
    }

    /**
     * Formula computed rolls
     * @return {Object<Roll>}
     */
    get rolls() {
        return this._rolls;
    }

    /**
     * Indicates if formula should be hidden from players
     * @return {boolean}
     */
    get hidden() {
        return this._hidden;
    }

    /**
     * Indicates if formula should be hidden from players
     * @return {boolean}
     */
    get explanation() {
        return this._explanation;
    }

    /**
     * Returns a plain object describing the formula
     * @return {{result: string, hasDice: boolean, hidden: boolean, raw: string, parsed: string, tokens: Object<string>, rolls: Object<Roll>}}
     */
    toJSON() {
        return {
            raw: this.raw,
            result: this.result,
            parsed: this.parsed,
            hasDice: this.hasDice,
            tokens: this.tokens,
            rolls: this.rolls,
            hidden: this.hidden,
            explanation: this.explanation
        };
    }

    /**
     * Computes this formula with given props and options, computing dynamic data like rolls and user inputs
     * @param {Object} props Token attributes to replace inside the formula
     * @param {Object} [options={}] Computation options
     * @param {string} [options.reference] Reference used in case of dynamic table field syntax
     * @param {string} [options.defaultValue] Default value used in case a variable is not present in props. If null, computation will throw an UncomputableError if a value is not found.
     * @param {Object} [options.localVars={}] Local variables computed from previous formulas in the same ComputablePhrase
     * @param {boolean} [options.computeExplanation=false] Indicates whether to compute Formula explanation
     * @returns {Promise<Formula>} This formula
     * @throws {UncomputableError} If a variable can not be computed
     */
    async compute(props, options = {}) {
        // Reference is used to compute formulas in dynamic table, to reference a same-line data
        // Default value is used in case a token is not computable
        // Local vars are used to re-use previously defined vars in the phrase
        let { localVars = {} } = options ?? {};

        console.debug('Computing rolls & user inputs in ${' + this._raw + '}$');

        let { formula, textVars } = handleTextVars(this._raw);

        // Rolls are formula-local tokens which hold the roll data
        let rolls = [];

        // If formula starts with #, it should not be visible by default
        if (formula.startsWith('#')) {
            this._hidden = true;
            formula = formula.substring(1);
        }

        // If formula starts with !, it should not be explained in the final chat message
        if (formula.startsWith('!')) {
            this._explanation = false;
            formula = formula.substring(1);
        }

        // Isolating user inputs, enclosed in ?{} inside the formula
        let userInputTokens = formula.matchAll(/\?{.*?}/g);
        let userInputToken = userInputTokens.next();

        let allUserVars = [];

        while (!userInputToken.done) {
            let userInputData = userInputToken.value[0].substring(2).slice(0, -1);
            let userInputName = userInputData.split('|', 2)[0];
            let userInputDefaultFormula = userInputData.split('|', 2)[1];

            let userInputDefault = null;
            if(userInputDefaultFormula) {
                userInputDefault = (await new Formula(userInputDefaultFormula).compute(props, options)).result;
            }

            allUserVars.push({
                name: userInputName,
                default: userInputDefault
            });

            formula = formula.replace(userInputToken.value[0], userInputName);

            userInputToken = userInputTokens.next();
        }

        if (allUserVars.length > 0) {
            let content = await renderTemplate(
                `systems/custom-system-builder/templates/_template/dialogs/user-input.html`,
                { allUserVars: allUserVars }
            );

            let userData = await new Promise((resolve) => {
                Dialog.prompt({
                    content: content,
                    callback: (html) => {
                        let values = {};
                        let inputs = $(html).find('input.custom-system-user-input');

                        for (let elt of inputs) {
                            values[$(elt).data('var-name')] = $(elt).val();
                        }

                        resolve(values);
                    },
                    render: (html) => {
                        $(html).find('input')[0].focus();
                        $(html).find('input')[0].select();
                    },
                    rejectClose: false
                });
            });

            localVars = { ...localVars, ...userData };
        }

        // Handling rolls - rolls are enclosed in brackets []
        let rollMessages = formula.matchAll(/\[.+?]/g);
        let roll = rollMessages.next();
        while (!roll.done) {
            // Evaluating roll with Foundry VTT Roll API
            let rollString = roll.value[0];

            console.debug('\tRolling ' + rollString);

            let rollResult = await this.evaluateRoll(rollString.substr(1).slice(0, -1), props, options);

            if (rollResult.results) {
                formula = formula.replace(
                    rollString,
                    "'" + rollResult.results.map((e) => e.getChatText()).join(', ') + "'"
                );
            } else {
                // Replacing roll result in formula for computing and saving roll data for display in chat message
                formula = formula.replace(rollString, rollResult.roll.total);

                let rollFormula =
                    rollString === '[' + rollResult.roll.formula + ']'
                        ? rollString
                        : rollString + ' → [' + rollResult.roll.formula + ']';

                rolls.push({ formula: rollFormula, roll: rollResult.roll.toJSON() });
            }

            roll = rollMessages.next();
        }

        return this.computeStatic(
            props,
            {
                ...options,
                localVars,
                textVars,
                rolls
            },
            formula
        );
    }

    /**
     * Computes this formula with given props and options, computing only static data
     * @param {Object} props Token attributes to replace inside the formula
     * @param {Object} [options={}] Computation options
     * @param {string} [options.reference] Reference used in case of dynamic table field syntax
     * @param {string} [options.defaultValue] Default value used in case a variable is not present in props. If null, computation will throw an UncomputableError if a value is not found.
     * @param {Object} [options.localVars={}] Local variables computed from previous formulas in the same ComputablePhrase
     * @param {Object} [options.textVars={}] Text variables pre-computed by compute method
     * @param {Array} [options.rolls=[]] Rolls variables pre-computed by compute method
     * @param {boolean} [options.computeExplanation=false] Indicates whether to compute Formula explanation
     * @param {string|null} [formula=null] Formula override used by compute method
     * @returns {Formula} This formula
     * @throws {UncomputableError} If a variable can not be computed
     */
    computeStatic(props, options = {}, formula = null) {
        formula = formula ?? this._raw;
        console.debug('Computing ${' + formula + '}$');

        let useLegacySyntax = false;

        let {
            reference,
            defaultValue,
            localVars = {},
            textVars = {},
            rolls = [],
            computeExplanation = false
        } = options;

        const getNumberCastValue = (value) => {
            if (Number.isNaN(Number(value))) {
                return value ?? defaultValue ?? null;
            } else {
                return Number(value);
            }
        };

        let allValues = {
            ...props,
            ...localVars
        };

        math.import(
            {
                fetchFromDynamicTable: (dynamicTableKey, targetColumn, filterColumn = null, filterValue = null) => {
                    let values = [];

                    let filterFunction = (elt) => true;

                    if (filterColumn) {
                        filterFunction = (elt) => elt[filterColumn] === filterValue;
                    }

                    if (foundry.utils.getProperty(allValues, dynamicTableKey) !== undefined) {
                        let dynamicTableProps = foundry.utils.getProperty(allValues, dynamicTableKey);
                        for (let row in dynamicTableProps) {
                            if (!dynamicTableProps[row].deleted && filterFunction(dynamicTableProps[row])) {
                                if (dynamicTableProps[row][targetColumn] === undefined) {
                                    throw new UncomputableError(
                                        'Uncomputable token fetchFromDynamicTable("' +
                                            dynamicTableKey +
                                            '", "' +
                                            targetColumn +
                                            '", "' +
                                            filterColumn +
                                            '", "' +
                                            filterValue +
                                            '")',
                                        'fetchFromDynamicTable("' +
                                            dynamicTableKey +
                                            '", "' +
                                            targetColumn +
                                            '", "' +
                                            filterColumn +
                                            '", "' +
                                            filterValue +
                                            '")',
                                        formula,
                                        allValues
                                    );
                                }

                                values.push(getNumberCastValue(dynamicTableProps[row][targetColumn]));
                            }
                        }
                    }

                    computedTokens[
                        'fetchFromDynamicTable("' +
                            dynamicTableKey +
                            '", "' +
                            targetColumn +
                            '", "' +
                            filterColumn +
                            '", "' +
                            filterValue +
                            '")'
                    ] = values;

                    return values;
                },
                first: (list = [], fallbackValue = null) => {
                    let returnValue = fallbackValue ?? defaultValue;

                    if (list.length > 0) {
                        returnValue = getNumberCastValue(list[0]);
                    }

                    return returnValue;
                },
                ref: (valueRef, fallbackValue = null) => {
                    let returnValue = fallbackValue ?? defaultValue;

                    if (valueRef) {
                        returnValue = getNumberCastValue(foundry.utils.getProperty(allValues, valueRef)) ?? returnValue;
                    }

                    if (returnValue === undefined) {
                        throw new UncomputableError(
                            'Uncomputable token ref(' + valueRef + ')',
                            'ref(' + valueRef + ')',
                            formula,
                            allValues
                        );
                    }

                    let fallbackValueString;
                    if (typeof fallbackValue === 'string') {
                        fallbackValueString = '"' + fallbackValue + '"';
                    } else {
                        fallbackValueString = fallbackValue;
                    }

                    computedTokens[
                        'ref("' + valueRef + (fallbackValue !== null ? '", ' + fallbackValueString : '"') + ')'
                    ] = returnValue;

                    return returnValue;
                },
                sameRow: (columnName, fallbackValue = null) => {
                    let fullReference = reference + '.' + columnName;

                    // Fetching the value inside dynamic table's row
                    let returnValue =
                        getNumberCastValue(foundry.utils.getProperty(allValues, fullReference)) ??
                        fallbackValue ??
                        defaultValue;

                    if (returnValue === undefined) {
                        throw new UncomputableError(
                            'Uncomputable token sameRow(' + columnName + ')',
                            'sameRow(' + columnName + ')',
                            formula,
                            allValues
                        );
                    }

                    computedTokens['sameRow("' + columnName + '")'] = returnValue;

                    return returnValue;
                }
            },
            { override: true }
        );

        // Detecting local variable to set
        let localVarName = null;
        let localVarDecomposed = formula.match(/^([a-zA-Z0-9_-]+):=(.*)$/);

        if (localVarDecomposed) {
            localVarName = localVarDecomposed[1];
            formula = localVarDecomposed[2];
        }

        // If text-vars exist, they have already been handled ; no need to do it again
        let textVarResult = handleTextVars(formula, textVars);
        formula = textVarResult.formula;
        textVars = textVarResult.textVars;

        // Stripping formula from remaining spaces to have a consistent parsable string
        // let strippedFormula = formula.replaceAll(' ', '').trim();
        let strippedFormula = formula.trim();

        // Fetching the rest of the tokens
        let tokens = strippedFormula.matchAll(/@?\$?[A-Za-z0-9_.]+(((\(.*?\))?\$)?[A-Za-z0-9_]+)?/g);
        let computedTokens = {};
        let renamedTokens = {};

        let token = tokens.next();
        let nTransformedNames = 0;
        while (!token.done) {
            let tokenString = token.value[0];

            // If token has already been computed, no need to recompute it
            if (!computedTokens[tokenString]) {
                let isReference = false;

                // If starts with @, the value in a reference to another field in which we should take the value
                if (tokenString.startsWith('@')) {
                    useLegacySyntax = true;
                    isReference = true;
                    tokenString = tokenString.substring(1);
                }

                // If starts with $, it references a same-line prop in a dynamic table
                if (tokenString.startsWith('$')) {
                    useLegacySyntax = true;

                    // Reference is 'dynamicTableKey.rowNumber'
                    let tokenPath = reference.split('.');

                    let cleanedTokenString = tokenString.substr(1);

                    // Fetching the value inside dynamic table's row
                    computedTokens[tokenString] = props[tokenPath[0]][tokenPath[1]][cleanedTokenString];
                } else if (tokenString.includes('$')) {
                    useLegacySyntax = true;

                    // If it contains a $ not in first position, this is a reference to a dynamic table column
                    let [dynamicTableExpr, targetColumn] = tokenString.split('$');

                    let [, dynamicTable, filterExpr, filterProp, filterRef, filterValue] = dynamicTableExpr.match(
                        /^([a-zA-Z0-9_.]+)(\(([a-zA-Z0-9_]+)(@?)=(.+)\))?$/
                    );

                    let values = [];

                    let filterFunction = (elt) => true;

                    // If matched, we must isolate the correct rows
                    if (filterExpr) {
                        // If expression is "@=", filterValue is a reference to another prop
                        if (filterRef === '@') {
                            foundry.utils.setProperty(
                                computedTokens,
                                filterValue,
                                foundry.utils.getProperty(props, filterValue)
                            );

                            filterValue = foundry.utils.getProperty(props, filterValue);
                        }

                        filterFunction = (elt) => elt[filterProp] === filterValue;
                    }

                    if (foundry.utils.getProperty(props, dynamicTable) !== undefined) {
                        let dynamicTableProps = foundry.utils.getProperty(props, dynamicTable);
                        for (let row in dynamicTableProps) {
                            if (!dynamicTableProps[row].deleted && filterFunction(dynamicTableProps[row])) {
                                if (dynamicTableProps[row][targetColumn] === undefined) {
                                    // If a value is undefined, throw error
                                    throw new UncomputableError(
                                        'Uncomputable token ' + tokenString,
                                        tokenString,
                                        formula,
                                        props
                                    );
                                }
                                values.push(
                                    isNaN(dynamicTableProps[row][targetColumn])
                                        ? 0
                                        : Number(dynamicTableProps[row][targetColumn])
                                );
                            }
                        }
                    }

                    let replacedTokenString = tokenString
                        .replaceAll(/[= .]/g, '_')
                        .replaceAll(/[(]/g, '$')
                        .replaceAll(/[@)]/g, '');

                    if (filterValue) {
                        let correctedFilterValue = filterValue
                            .replaceAll(/[= .]/g, '_')
                            .replaceAll(/[(]/g, '$')
                            .replaceAll(/[)]/g, '');

                        let validCharacterRegex = /[a-zA-Z_0-9\u00C0-\u02AF\u0370-\u037D\u037F-\u03FF]/;
                        for (let i = 0; i < filterValue.length; i++) {
                            if (!validCharacterRegex.test(filterValue.charAt(i))) {
                                correctedFilterValue = correctedFilterValue.replace(
                                    filterValue.charAt(i),
                                    '\u037E' + String(filterValue.charAt(i).codePointAt(0)) + '\u037E'
                                );
                            }
                        }

                        replacedTokenString = replacedTokenString.replace(filterValue, correctedFilterValue);
                    }

                    strippedFormula = strippedFormula.replaceAll(tokenString, replacedTokenString);

                    foundry.utils.setProperty(
                        computedTokens,
                        replacedTokenString,
                        values.length === 1 ? values[0] : values
                    );
                }

                if (isReference) {
                    let realToken = '@' + tokenString;

                    let transformedName = '_reference_' + nTransformedNames;
                    nTransformedNames++;
                    strippedFormula = strippedFormula.replace(realToken, transformedName);

                    let finalValue = foundry.utils.getProperty(
                        allValues,
                        foundry.utils.getProperty(computedTokens, tokenString)
                    );

                    if (finalValue) {
                        foundry.utils.setProperty(
                            computedTokens,
                            foundry.utils.getProperty(computedTokens, tokenString),
                            finalValue
                        );

                        foundry.utils.setProperty(computedTokens, transformedName, finalValue);
                    }
                }
            }

            token = tokens.next();
        }

        let mathTokens = { ...computedTokens, ...renamedTokens, ...textVars, ...allValues };
        console.debug({ formula: strippedFormula, scope: mathTokens });
        if (useLegacySyntax) {
            console.warn(
                'This formula is using legacy syntax. Please fix before Foundry 11 is out. ${' + this._raw + '}$'
            );
        }

        let result;
        let explanation = [];

        let onUndefinedSymbol = math.SymbolNode.onUndefinedSymbol;
        try {
            math.SymbolNode.onUndefinedSymbol = (name) => {
                if (defaultValue !== undefined) {
                    return defaultValue;
                } else {
                    throw new UncomputableError('Uncomputable token ' + name, name, formula, props);
                }
            };

            let node = math.parse(strippedFormula);
            result = node.evaluate(mathTokens);

            if (computeExplanation) {
                explanation = this.getSymbolsInOrder(node, { children: [] }, mathTokens);
                console.debug({ name: strippedFormula, children: [this.getSymbolTree(node)] });
                console.debug({ name: strippedFormula, listInOrder: explanation });
            }
        } catch (err) {
            if (err instanceof UncomputableError) {
                throw err;
            } else {
                result = 'ERROR';
                console.error(err);
            }
        } finally {
            // Reset onUndefinedSymbol
            math.SymbolNode.onUndefinedSymbol = onUndefinedSymbol;
        }

        if (localVarName) {
            localVars[localVarName] = result;
        }

        // Save every detail of the computation
        this._result = result;
        this._localVars = localVars;
        this._parsed = strippedFormula;
        this._hasDice = rolls.length > 0;
        this._tokens = explanation;
        this._rolls = rolls;

        return this;
    }

    /**
     * Evaluates a roll expression through Foundry VTT Roll API
     * @param {string} rollText The FoundryVTT roll expression
     * @param {Object} props Token attributes to replace inside the formula
     * @param {Object} options Computation options for replaceable variables in the roll expression
     * @returns {Roll}
     */
    async evaluateRoll(rollText, props, options) {
        const computeRollPhrase = async (text) => {
            // Roll can contain parameters delimited by colons (:)
            let textParamMatcher = text.matchAll(/:(.*?):/g);
            let textParam = textParamMatcher.next();

            // Start by building a temporary phrase with every found parameter
            // A roll like [1d100 + :STR:] will become [1d100 + ${STR}$], which can be computed like other formulas
            while (!textParam.done) {
                text = text.replace(textParam.value[0], `\${${textParam.value[1]}}\$`);
                textParam = textParamMatcher.next();
            }

            // Temporary phrase is computed to get a number & dice only phrase
            let finalText = new ComputablePhrase(text);
            await finalText.compute(props, options);

            return finalText;
        };

        let isRollTable = false;
        let selectValue = null;
        if (rollText.startsWith('#')) {
            isRollTable = true;
            let separatedRoll = rollText.substring(1).split('|', 2);
            rollText = separatedRoll[0];
            selectValue = separatedRoll[1] ?? null;
        }

        let finalRollText = await computeRollPhrase(rollText);

        if (isRollTable) {
            let rollTable = game.tables.filter((e) => e.name === finalRollText.result)[0];
            if (selectValue) {
                let finalSelectValue = await computeRollPhrase(selectValue);

                let roll = new Roll(finalSelectValue.result);
                await roll.evaluate({ async: true });

                return await rollTable.draw({ displayChat: false, roll });
            } else {
                return await rollTable.draw({ displayChat: false });
            }
        } else {
            // Roll evaluation
            let roll = new Roll(finalRollText.result);
            await roll.evaluate({ async: true });

            return { roll };
        }
    }

    getSymbolsInOrder(rootNode, currentSymbol, mathTokens) {
        if (rootNode.type === 'SymbolNode' && !math[rootNode.name] && !rootNode.name.startsWith('_')) {
            currentSymbol = {
                display: rootNode.name,
                handle: rootNode.name,
                children: [],
                value: rootNode.evaluate(mathTokens)
            };
        } else if (
            rootNode.type === 'FunctionNode' &&
            ['fetchFromDynamicTable', 'ref', 'sameRow'].includes(rootNode.name)
        ) {
            let argsName = [];
            switch (rootNode.name) {
                case 'fetchFromDynamicTable':
                    argsName = ['', 'Target', 'Where', 'Is'];
                    break;
                case 'ref':
                    argsName = ['', 'Default'];
                    break;
            }

            let functionHandle =
                rootNode.name +
                '(' +
                rootNode.args
                    .map(
                        (arg, idx) =>
                            (argsName[idx]
                                ? '<span class="custom-system-arg-tooltip">' + argsName[idx] + ' : </span>'
                                : '') + arg
                    )
                    .join(', ') +
                ')';

            currentSymbol = {
                handle: rootNode.toString(),
                display: functionHandle,
                children: [],
                value: rootNode.evaluate(mathTokens)
            };
        }

        rootNode.forEach((node, path, parent) => {
            let subSymbol = this.getSymbolsInOrder(node, currentSymbol, mathTokens);

            if (subSymbol.display !== currentSymbol.display) {
                if (!currentSymbol.children.some((e) => e.display === subSymbol.display)) {
                    currentSymbol.children.push(subSymbol);
                }
            }
        });

        return currentSymbol;
    }

    getSymbolTree(rootNode) {
        let treeNode = {
            name:
                rootNode.type +
                ' (' +
                (rootNode.name ?? rootNode.op ?? rootNode.value ?? '') +
                ') --- ' +
                rootNode.toString(),
            children: []
        };

        rootNode.forEach((node, path, parent) => {
            treeNode.children.push(this.getSymbolTree(node));
        });

        return treeNode;
    }
}

/**
 * Handles text variables by extracting them and replacing them with tokens
 * @param formula
 * @param textVars Text vars are formula-local tokens which hold the texts
 * @returns {Object}
 * @ignore
 */
const handleTextVars = (formula, textVars = {}) => {
    // Isolating text data, enclosed in '' inside the formula
    // The (?<!\\)' part means match quotes (') which are not preceded by \
    let textTokens = formula.matchAll(/(?<!\\)'.*?(?<!\\)'/g);
    let textToken = textTokens.next();

    while (!textToken.done) {
        let textValue = textToken.value[0].substring(1, textToken.value[0].length - 1);
        if (textValue.includes("'")) {
            let textRef = '_computedText_' + (Object.keys(textVars).length + 1);

            // Recreate apostrophes inside text + removing delimiters
            textVars[textRef] = textValue.replace('\\', '');

            formula = formula.replace(textToken.value[0], textRef);
        }

        textToken = textTokens.next();
    }

    return { formula, textVars };
};

export default Formula;
