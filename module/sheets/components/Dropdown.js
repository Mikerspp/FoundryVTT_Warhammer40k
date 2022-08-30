import InputComponent from './InputComponent.js';

/**
 * Dropdown component
 * @ignore
 */
class Dropdown extends InputComponent {
    /**
     * Options
     * @type {Array<{key: string, value: string}>}
     * @private
     */
    _options;

    /**
     * Dynamic table key
     * @type {string | null}
     * @private
     */
    _tableKey;

    /**
     * Key of the column to use as options keys
     * @type {string | null}
     * @private
     */
    _tableKeyColumn;

    /**
     * Key of the column to use as labels
     * @type {string | null}
     * @private
     */
    _tableLabelColumn;

    /**
     * Dropdown constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {string|null} [data.label=null] Field label
     * @param {string|null} [data.defaultValue=null] Field default value
     * @param {Array<Object>} [data.options=[]] Select options
     * @param {string|null} [data.tableKey=null] Select dynamic table source
     * @param {string|null} [data.tableKeyColumn=null] Select dynamic table source column to use as key
     * @param {string|null} [data.tableLabelColumn=null] Select dynamic table source column to use as labels
     * @param {string|null} [data.size=null] Field size. Can be full-size, small, medium or large.
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        label = null,
        defaultValue = null,
        options = [],
        tableKey = null,
        tableKeyColumn = null,
        tableLabelColumn = null,
        size = null,
        cssClass = null,
        role = 0,
        permission = 0
    }) {
        super({
            key: key,
            tooltip: tooltip,
            templateAddress: templateAddress,
            label: label,
            defaultValue: defaultValue,
            size: size,
            cssClass: cssClass,
            role: role,
            permission: permission
        });
        this._options = options;
        this._tableKey = tableKey;
        this._tableKeyColumn = tableKeyColumn;
        this._tableLabelColumn = tableLabelColumn;
    }

    /**
     * Renders component
     * @override
     * @param {CustomActor} actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(actor, isEditable = true, options = {}) {
        let jQElement = await super._getElement(actor, isEditable, options);
        jQElement.addClass('custom-system-select');

        let selectElement = $('<select />');
        selectElement.attr('id', this.key);

        if (!actor.isTemplate) {
            selectElement.attr('name', 'data.props.' + this.key);
        }

        if (!isEditable) {
            selectElement.attr('disabled', 'disabled');
        }

        if (!this.defaultValue) {
            let emptyOption = $('<option></option>');
            emptyOption.attr('value', '');
            selectElement.append(emptyOption);
        }

        if (this._tableKey !== null) {
            let dynamicProps = foundry.utils.getProperty(actor.data.data.props, this._tableKey);
            if (dynamicProps) {
                for (let rowIndex in dynamicProps) {
                    if (dynamicProps.hasOwnProperty(rowIndex) && !dynamicProps[rowIndex]?.deleted) {
                        let optionElement = $('<option></option>');
                        optionElement.attr('value', dynamicProps[rowIndex][this._tableKeyColumn]);
                        optionElement.text(
                            this._tableLabelColumn
                                ? dynamicProps[rowIndex][this._tableLabelColumn]
                                : dynamicProps[rowIndex][this._tableKeyColumn]
                        );

                        selectElement.append(optionElement);
                    }
                }
            }

            for (let row of this._options) {
            }
        } else {
            for (let option of this._options) {
                let optionElement = $('<option></option>');
                optionElement.attr('value', option.key);
                optionElement.text(option.value);

                selectElement.append(optionElement);
            }
        }

        selectElement.val(
            foundry.utils.getProperty(actor.data.data.props, this.key) ??
                this.defaultValue ??
                selectElement.find('option:first').val()
        );
        jQElement.append(selectElement);

        if (actor.isTemplate) {
            jQElement.addClass('custom-system-editable-component');

            selectElement.on('mousedown', (ev) => {
                ev.preventDefault();
                selectElement.trigger('blur');
            });

            jQElement.on('click', () => {
                this.editComponent(actor);
            });
        }

        return jQElement;
    }

    /**
     * Returns serialized component
     * @override
     * @return {Object}
     */
    toJSON() {
        let jsonObj = super.toJSON();

        return {
            ...jsonObj,
            options: this._options,
            tableKey: this._tableKey,
            tableKeyColumn: this._tableKeyColumn,
            tableLabelColumn: this._tableLabelColumn,
            type: 'select'
        };
    }

    /**
     * Creates Dropdown from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @return {Dropdown}
     */
    static fromJSON(json, templateAddress) {
        return new Dropdown({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            label: json.label,
            defaultValue: json.defaultValue,
            options: json.options,
            tableKey: json.tableKey,
            tableKeyColumn: json.tableKeyColumn,
            tableLabelColumn: json.tableLabelColumn,
            size: json.size,
            cssClass: json.cssClass,
            role: json.role,
            permission: json.permission
        });
    }

    /**
     * Gets pretty name for this component's type
     * @return {string} The pretty name
     * @throws {Error} If not implemented
     */
    static getPrettyName() {
        return 'Dropdown list';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate('systems/custom-system-builder/templates/_template/components/dropdown.html', {
                ...existingComponent,
                dynamicTableOptions: existingComponent && existingComponent.tableKey !== null
            })
        );

        return mainElt;
    }

    /**
     * Extracts configuration from submitted HTML form
     * @override
     * @param {JQuery<HTMLElement>} html The submitted form
     * @return {Object} The JSON representation of the component
     * @throws {Error} If configuration is not correct
     */
    static extractConfig(html) {
        let fieldData = super.extractConfig(html);

        if (!fieldData.key) {
            throw new Error('Component key is mandatory for dropdowns');
        }

        fieldData.label = html.find('#selectLabel').val();
        fieldData.defaultValue = html.find('#selectDefaultValue').val();
        fieldData.size = html.find('#selectSize').val();

        let optionRows = html.find('tr.custom-system-dropdown-option');

        fieldData.options = [];
        fieldData.tableKey = null;
        fieldData.tableKeyColumn = null;
        fieldData.tableLabelColumn = null;

        if (html.find('#dynamicTableOptions').is(':checked')) {
            fieldData.tableKey = html.find('#selectDynamicTableKey').val();
            fieldData.tableKeyColumn = html.find('#selectDynamicTableKeyColumn').val();
            fieldData.tableLabelColumn = html.find('#selectDynamicTableLabelColumn').val();

            if (!fieldData.tableKey || !fieldData.tableKeyColumn) {
                throw new Error('Dynamic table key and column key must be entered.');
            }
        } else {
            for (let optionRow of optionRows) {
                let optKey = $(optionRow).find('.custom-system-dropdown-option-key').val();
                let optVal = $(optionRow).find('.custom-system-dropdown-option-value').val();

                if (optKey === '') {
                    throw new Error('Every option must have a key');
                }

                fieldData.options.push({
                    key: optKey,
                    value: optVal
                });
            }
        }

        return fieldData;
    }
}

/**
 * @ignore
 */
export default Dropdown;
