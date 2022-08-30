import { UncomputableError } from '../errors/errors.js';
import { applyModifiers } from '../utils.js';

export class CustomItem extends Item {
    /**
     * Is this item a Template ?
     * @return {boolean}
     */
    get isTemplate() {
        return this.data.type === '_equippableItemTemplate' || this.data.type === 'subTemplate';
    }

    get items() {
        return new Collection();
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
        const itemData = this.data;

        this._prepareItemData(itemData);
    }

    /**
     * Prepare Item type specific data
     * @private
     */
    _prepareItemData(itemData) {
        if (itemData.type !== 'equippableItem') return;

        // Make modifications to data here.
        const data = itemData.data;

        // Computing item modifiers
        const modifierPropsByKey = {};

        /*
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
*/

        // Computing all properties
        let computableProps = {};

        // Computable properties are labels within tabs / header and hidden attributes
        let headerSpecialFields = this._fetchSpecialFields(data.header);

        computableProps = {
            ...computableProps,
            ...headerSpecialFields.computable
        };

        let bodySpecialFields = this._fetchSpecialFields(data.body);

        computableProps = {
            ...computableProps,
            ...bodySpecialFields.computable
        };

        for (let hidden of data.hidden) {
            computableProps[hidden.name] = hidden.value;
        }

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
    }

    /**
     * Gets all special fields in a given component, and returns :
     * - computable and their formula
     * - rollable and their rollMessages
     * - attribute bars and their maximum value
     * @param {Component} component The root component to extract fields from
     * @param {Object} specialFieldList The combined list of special fields and info
     * @param {Object} specialFieldList.computable The list of Computable fields
     * @param {Object} specialFieldList.keyedProperties The list of keyed properties in the template
     * @param {string} keyPrefix The prefix to add to a key, if needed
     * @return {Object} The combined list of special fields and info
     * @private
     */
    _fetchSpecialFields(component, specialFieldList = { computable: {}, keyedProperties: [] }, keyPrefix = '') {
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
                    if (component.value) {
                        specialFieldList.computable[keyPrefix + component.key] = component.value;
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
     * Reloads this item's templates, updating the component structure, and re-renders the sheet.
     * @param {string|null} [templateId=null] New template id. If not set, will reload the current template.
     */
    reloadTemplate(templateId = null) {
        templateId = templateId || this.data.data.template;

        const template = game.items.get(templateId);

        this.sheet._hasBeenRenderedOnce = false;

        // Updates hidden properties, tabs & header data
        // Sheet rendering will handle the actual props creation
        this.update({
            data: {
                template: templateId,
                hidden: template.data.data.hidden,
                body: template.data.data.body,
                header: template.data.data.header,
                display: template.data.data.display
            }
        }).then(() => {
            console.debug('Updated !');
            this.sheet.render(false);
        });
    }
}
