import { UncomputableError } from '../errors/errors.js';
import { applyModifiers } from '../utils.js';

/**
 * Extend the base Actor document
 * @extends {Actor}
 */
export class CustomActor extends Actor {
    /**
     * Is this actor a Template ?
     * @return {boolean}
     */
    get isTemplate() {
        return this.data.type === '_template';
    }

    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);

        if (!data.flags?.['custom-system-builder']?.version) {
            this.setFlag('custom-system-builder', 'version', game.system.data.version);
        }
    }

    _preCreateEmbeddedDocuments(embeddedName, result, options, userId) {
        if (embeddedName === 'Item') {
            if (this.isTemplate) {
                result.splice(0, result.length);
            } else {
                let idxToRemove = [];
                for (let document of result) {
                    if (document.type !== 'equippableItem') {
                        idxToRemove.push(result.indexOf(document));
                    } else if (document.data.unique) {
                        for (let item of this.items) {
                            if (item.getFlag('core', 'sourceId') === document.flags.core.sourceId) {
                                idxToRemove.push(result.indexOf(document));
                                break;
                            }
                        }
                    }
                }

                for (let i = idxToRemove.length - 1; i >= 0; i--) {
                    result.splice(idxToRemove[i], 1);
                }
            }
        }
    }

    /**
     * @override
     * @ignore
     */
    prepareDerivedData() {
        const actorData = this.data;

        this._prepareCharacterData(actorData);
    }

    /**
     * Prepare Character type specific data
     * @private
     */
    _prepareCharacterData(actorData) {
        if (actorData.type !== 'character') return;

        // Make modifications to data here.
        const data = actorData.data;

        // Computing item modifiers
        const modifierPropsByKey = {};

        for (let item of this.items) {
            if (item.data.data.modifiers) {
                for (let modifier of item.data.data.modifiers) {
                    if (!modifierPropsByKey[modifier.key]) {
                        modifierPropsByKey[modifier.key] = [];
                    }

                    modifier.value = ComputablePhrase.computeMessageStatic(modifier.formula, item.data.data.props, {
                        defaultValue: 0
                    });

                    modifierPropsByKey[modifier.key].push(modifier);
                }
            }
        }

        for (let effect of this.effects) {
            if (this.data.data.activeEffects[effect.getFlag('core', 'statusId')]) {
                for (let modifier of this.data.data.activeEffects[effect.getFlag('core', 'statusId')]) {
                    if (!modifierPropsByKey[modifier.key]) {
                        modifierPropsByKey[modifier.key] = [];
                    }

                    modifier.value = ComputablePhrase.computeMessageStatic(modifier.formula, this.data.data.props, {
                        defaultValue: 0
                    });

                    modifierPropsByKey[modifier.key].push(modifier);
                }
            }
        }

        // Computing all properties
        let computableProps = {};
        let attributeBars = data.attributeBar;

        // Computable properties are labels within tabs / header and hidden attributes
        let headerSpecialFields = this._fetchSpecialFields(data.header);

        computableProps = {
            ...computableProps,
            ...headerSpecialFields.computable
        };

        attributeBars = {
            ...attributeBars,
            ...headerSpecialFields.attributeBar
        };

        let bodySpecialFields = this._fetchSpecialFields(data.body);

        computableProps = {
            ...computableProps,
            ...bodySpecialFields.computable
        };

        attributeBars = {
            ...attributeBars,
            ...bodySpecialFields.attributeBar
        };

        for (let hidden of data.hidden) {
            computableProps[hidden.name] = hidden.value;
        }

        const removeEmpty = (obj) => {
            let newObj = {};
            Object.keys(obj).forEach((key) => {
                if (obj[key] === Object(obj[key])) newObj[key] = removeEmpty(obj[key]);
                else if (obj[key] !== undefined) newObj[key] = obj[key];
            });
            return newObj;
        };

        for (let prop in computableProps) {
            if (prop.includes('.')) {
                let [dynamicTableKey, dynamicTableField] = prop.split('.');

                for (let row in foundry.utils.getProperty(data.props, dynamicTableKey)) {
                    if (!foundry.utils.getProperty(data.props, dynamicTableKey + '.' + row).deleted) {
                        foundry.utils.setProperty(
                            data.props,
                            `${dynamicTableKey}.${row}.${dynamicTableField}`,
                            undefined
                        );
                    }
                }
            } else {
                foundry.utils.setProperty(data.props, prop, undefined);
            }
        }

        data.props = removeEmpty(data.props);

        let computedProps;
        let uncomputedProps = { ...computableProps };

        // Loop while all props are not computed
        // Some computed properties are used in other computed properties, so we need to make several passes to compute them all
        do {
            computedProps = {};

            // For each uncomputed property, we try compute it
            for (let prop in uncomputedProps) {
                try {
                    let newComputedRows = {};

                    if (prop.includes('.')) {
                        let [dynamicTableKey, dynamicTableField] = prop.split('.');

                        for (let row in foundry.utils.getProperty(data.props, dynamicTableKey)) {
                            if (!foundry.utils.getProperty(data.props, dynamicTableKey + '.' + row).deleted) {
                                foundry.utils.setProperty(
                                    newComputedRows,
                                    `${dynamicTableKey}.${row}.${dynamicTableField}`,
                                    ComputablePhrase.computeMessageStatic(uncomputedProps[prop], data.props, {
                                        reference: `${dynamicTableKey}.${row}`
                                    }).result
                                );
                            }
                        }
                    } else {
                        newComputedRows[prop] = ComputablePhrase.computeMessageStatic(
                            uncomputedProps[prop],
                            data.props
                        ).result;

                        if (modifierPropsByKey[prop]) {
                            newComputedRows[prop] = applyModifiers(newComputedRows[prop], modifierPropsByKey[prop]);
                        }
                    }

                    // If successful, the property is added to computedProp and deleted from uncomputedProps
                    console.debug('Computed ' + prop + ' successfully !');
                    foundry.utils.mergeObject(computedProps, newComputedRows);
                    delete uncomputedProps[prop];
                } catch (err) {
                    if (err instanceof UncomputableError) {
                        console.debug(
                            'Passing prop ' + prop + ' (' + uncomputedProps[prop] + ') to next round of computation...'
                        );
                    } else {
                        throw err;
                    }
                }
            }

            console.log({
                message:
                    'Computed props for ' +
                    this.data.name +
                    ' - ' +
                    Object.keys(computedProps).length +
                    ' / ' +
                    Object.keys(uncomputedProps).length,
                computedProps: computedProps,
                leftToCompute: uncomputedProps
            });

            // We add the props computed in this loop to the actor's data
            data.props = foundry.utils.mergeObject(data.props, computedProps);
        } while (
            // If no uncomputed props are left, we computed everything and we can stop
            // If computedProps is empty, that means nothing was computed in this loop, and there is an error in the property definitions
            // Probably a wrongly defined formula, or a loop in property definition
            Object.keys(uncomputedProps).length > 0 &&
            Object.keys(computedProps).length > 0
        );

        // We log the remaining uncomputable properties for debug
        if (Object.keys(uncomputedProps).length > 0) {
            console.warn('Some props were not computed.');
            console.warn(uncomputedProps);
        }

        for (let prop in attributeBars) {
            // Attribute bars can not be taken from dynamic tables
            if (!prop.includes('.')) {
                let max = attributeBars[prop].max;
                if (Number.isNaN(Number(max))) {
                    max = ComputablePhrase.computeMessageStatic(max ?? '0', data.props, { defaultValue: 0 }).result;
                }

                let value = attributeBars[prop].value ?? foundry.utils.getProperty(data.props, prop);
                if (Number.isNaN(Number(value))) {
                    value = ComputablePhrase.computeMessageStatic(value ?? '0', data.props, { defaultValue: 0 }).result;
                }

                foundry.utils.setProperty(data.attributeBar, prop, {
                    value: value,
                    max: max,
                    key: prop
                });
            }
        }
    }

    /**
     * @ignore
     * @override
     */
    getRollData() {
        const data = foundry.utils.deepClone(super.getRollData());

        // Prepare character roll data.
        this._getCharacterRollData(data);
        data.name = this.data.name;

        return data;
    }

    /**
     * @ignore
     * @override
     */
    getTokenData(data = {}) {
        const tokenData = foundry.utils.deepClone(super.getTokenData(data));

        // Prepare character roll data.
        this._getCharacterRollData(tokenData);

        return tokenData;
    }

    /**
     * Prepare character roll data.
     * @private
     */
    _getCharacterRollData(data) {
        if (this.data.type !== 'character') return;

        if (data.props) {
            for (let [k, v] of Object.entries(data.props)) {
                data[k] = foundry.utils.deepClone(v);
            }
        }

        if (data.body) {
            delete data.body;
        }
        if (data.header) {
            delete data.header;
        }
        if (data.hidden) {
            delete data.hidden;
        }
        if (data.display) {
            delete data.display;
        }
        if (data.template) {
            delete data.template;
        }
    }

    /**
     * Rolls a template's defined roll with this Character properties
     * @param {string} rollKey The key of the Component holding the roll
     * @param {Object} [options={}] Roll options
     * @param {boolean} [options.postMessage=true] If the roll should be automatically posted as a Chat Message
     * @returns {Promise<ComputablePhrase>} The computed roll
     * @throws {Error} If the key does not have a roll
     */
    async roll(rollKey, options = {}) {
        let { postMessage = true, alternative = false } = options;
        let refRoll = rollKey.split('.');
        let reference = null;
        let [filterMatch, parentProp, filterProp, filterValue] =
            refRoll.shift().match(/^([a-zA-Z0-9_]+)\(([a-zA-Z0-9_]+)=(.+)\)$/) ?? [];

        if (filterMatch) {
            let parent = foundry.utils.getProperty(this.getRollData(), parentProp);

            let index = Object.keys(parent).filter((key) => parent[key][filterProp] === filterValue)[0];

            if (!index) {
                throw new Error('Roll formula not found in character sheet');
            }

            reference = parentProp + '.' + index;
            rollKey = parentProp + '.' + refRoll.join('.');
        }

        let rollType = alternative ? 'alternative' : 'main';

        // Recovering value from data
        let rollText = this.getCustomRolls()[rollType][rollKey];

        if (rollText) {
            let phrase = new ComputablePhrase(rollText);
            await phrase.compute(this.data.data.props, {
                reference: reference,
                computeExplanation: true
            });

            if (postMessage) {
                let speakerData = ChatMessage.getSpeaker({
                    actor: this,
                    token: this.getActiveTokens()?.[0]?.document,
                    scene: game.scenes.current
                });

                phrase.postMessage({
                    speaker: speakerData
                });
            }

            return phrase;
        } else {
            throw new Error('Roll formula not found in character sheet');
        }
    }

    /**
     * Gets all custom rolls defined in the character's template
     * @returns {Object}}
     */
    getCustomRolls() {
        // Computing all properties
        let customRolls = {
            main: {},
            alternative: {}
        };

        // Computable properties are labels within tabs / header and hidden attributes
        let headerRolls = this._fetchSpecialFields(this.data.data.header);

        customRolls.main = {
            ...customRolls.main,
            ...headerRolls.rollable
        };

        customRolls.alternative = {
            ...customRolls.alternative,
            ...headerRolls.altRollable
        };

        let bodyRolls = this._fetchSpecialFields(this.data.data.body);
        customRolls.main = {
            ...customRolls.main,
            ...bodyRolls.rollable
        };

        customRolls.alternative = {
            ...customRolls.alternative,
            ...bodyRolls.altRollable
        };

        return customRolls;
    }

    /**
     * Gets all special fields in a given component, and returns :
     * - computable and their formula
     * - rollable and their rollMessages
     * - attribute bars and their maximum value
     * @param {Component} component The root component to extract fields from
     * @param {Object} specialFieldList The combined list of special fields and info
     * @param {Object} specialFieldList.rollable The list of Rollable fields
     * @param {Object} specialFieldList.computable The list of Computable fields
     * @param {Object} specialFieldList.attributeBar The list of Attribute Bars
     * @param {Object} specialFieldList.keyedProperties The list of keyed properties in the template
     * @param {string} keyPrefix The prefix to add to a key, if needed
     * @return {Object} The combined list of special fields and info
     * @private
     */
    _fetchSpecialFields(
        component,
        specialFieldList = { rollable: {}, altRollable: {}, attributeBar: {}, computable: {}, keyedProperties: [] },
        keyPrefix = ''
    ) {
        if (component) {
            // Handling the table case, where the contents list is an Array of Arrays
            if (Array.isArray(component)) {
                for (let subComp of component) {
                    let subSpecialList = this._fetchSpecialFields(subComp, specialFieldList, keyPrefix);
                    specialFieldList = {
                        ...specialFieldList,
                        ...subSpecialList
                    };
                }
            } else {
                // Component needs key to be relevant
                if (component.key) {
                    if (component.rollMessage) {
                        specialFieldList.rollable[keyPrefix + component.key] = component.rollMessage;
                    }

                    if (component.altRollMessage) {
                        specialFieldList.altRollable[keyPrefix + component.key] = component.altRollMessage;
                    }

                    if (component.value) {
                        specialFieldList.computable[keyPrefix + component.key] = component.value;
                    }

                    if (component.maxVal) {
                        specialFieldList.attributeBar[keyPrefix + component.key] = { max: component.maxVal };
                    }

                    specialFieldList.keyedProperties.push(keyPrefix + component.key);
                }

                // Recurse on contents
                if (component.contents) {
                    let subSpecialList = this._fetchSpecialFields(component.contents, specialFieldList, keyPrefix);
                    specialFieldList = {
                        ...specialFieldList,
                        ...subSpecialList
                    };
                }
                // Recurse on dynamic tables
                if (component.rowLayout) {
                    let subSpecialList = this._fetchSpecialFields(
                        component.rowLayout,
                        specialFieldList,
                        keyPrefix + component.key + '.'
                    );
                    specialFieldList = {
                        ...specialFieldList,
                        ...subSpecialList
                    };
                }
            }
        }

        return specialFieldList;
    }

    /**
     * Gets all keys in template, in a set
     * @return {Set} The set of keys
     */
    getKeys() {
        let keys = new Set();

        for (let hiddenProp of this.data.data.hidden) {
            keys.add(hiddenProp.name);
        }

        let keyedPropsHeader = this._fetchSpecialFields(this.data.data.header).keyedProperties;
        let keyedPropsBody = this._fetchSpecialFields(this.data.data.body).keyedProperties;

        for (let key of keyedPropsHeader) {
            keys.add(key);
        }

        for (let key of keyedPropsBody) {
            keys.add(key);
        }

        // Adding special key 'name', used by the field on top of the sheets.
        keys.add('name');

        return keys;
    }

    /**
     * Reloads this character templates, updating the component structure, and re-renders the sheet.
     * @param {string|null} [templateId=null] New template id. If not set, will reload the current template.
     */
    reloadTemplate(templateId = null) {
        templateId = templateId || this.data.data.template;

        const template = game.actors.get(templateId);

        for (let barName in this.data.data.attributeBar) {
            if (!template.data.data.attributeBar[barName]) {
                template.data.data.attributeBar['-=' + barName] = null;
            }
        }

        let availableKeys = template.getKeys();
        for (let prop in this.data.data.props) {
            if (!availableKeys.has(prop)) {
                this.data.data.props['-=' + prop] = true;
            }
        }

        this.sheet._hasBeenRenderedOnce = false;

        // Updates hidden properties, tabs & header data
        // Sheet rendering will handle the actual props creation
        this.update({
            data: {
                template: templateId,
                hidden: template.data.data.hidden,
                body: template.data.data.body,
                header: template.data.data.header,
                display: template.data.data.display,
                attributeBar: template.data.data.attributeBar,
                activeEffects: template.data.data.activeEffects,
                props: this.data.data.props
            }
        }).then(() => {
            console.debug('Updated !');
            this.sheet.render(false);
        });
    }
}

Hooks.on('renderTokenHUD', async (tokenHUD, html, data) => {
    for (let barId of ['bar1', 'bar2']) {
        let barData = data?.[barId + 'Data'];
        if (barData) {
            let barAttribute = barData.attribute;

            if (barAttribute?.startsWith('props') || barAttribute?.startsWith('attributeBar')) {
                let actor = tokenHUD.object.actor;

                let propPath = barAttribute;
                if (barAttribute.startsWith('attributeBar')) {
                    let barDefinition = foundry.utils.getProperty(actor.data.data, barAttribute);
                    propPath = 'props.' + barDefinition?.key;
                }

                let propValue = foundry.utils.getProperty(actor.data.data, propPath);

                if (propValue) {
                    html.find('div.' + barId + ' input').attr('disabled', false);
                    html.find('div.' + barId + ' input').on('change', async (ev) => {
                        let target = $(ev.currentTarget);
                        let strVal = target.val();

                        let isDelta = strVal.startsWith('+') || strVal.startsWith('-');
                        if (strVal.startsWith('=')) strVal = strVal.slice(1);
                        let value = Number(strVal);

                        if (isDelta || propValue !== value) {
                            if (barData.type === 'bar') {
                                if (isDelta) value = Math.min(Number(propValue) + value, barData.max);
                            } else {
                                if (isDelta) value = Number(propValue) + value;
                            }

                            foundry.utils.setProperty(actor.data.data, propPath, value);
                            await actor.update({
                                data: {
                                    props: actor.data.data.props
                                }
                            });

                            await actor.sheet.render(false);
                        }
                    });
                }
            }
        }
    }
});
