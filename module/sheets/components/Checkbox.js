import InputComponent from './InputComponent.js';

/**
 * Checkbox component
 * @ignore
 */
class Checkbox extends InputComponent {
    /**
     * Checkbox constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {string|null} [data.label=null] Field label
     * @param {string|null} [data.size=null] Field size. Can be full-size, small, medium or large.
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        label = null,
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
            defaultValue: null,
            size: size,
            cssClass: cssClass,
            role: role,
            permission: permission
        });
    }

    /**
     * Renders component
     * @override
     * @param {CustomActor} actor Rendered actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(actor, isEditable = true, options = {}) {
        let jQElement = await super._getElement(actor, isEditable, options);
        jQElement.addClass('custom-system-checkbox');

        let inputElement = $('<input />');
        inputElement.attr('type', 'checkbox');
        inputElement.attr('id', this.key);

        if (!actor.isTemplate) {
            inputElement.attr('name', 'data.props.' + this.key);
        }

        if (foundry.utils.getProperty(actor.data.data.props, this.key)) {
            inputElement.attr('checked', 'checked');
        }

        if (!isEditable) {
            inputElement.attr('disabled', 'disabled');
        }

        jQElement.append(inputElement);

        if (actor.isTemplate) {
            jQElement.addClass('custom-system-editable-component');
            inputElement.on('click', (ev) => {
                ev.preventDefault();
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
            type: 'checkbox'
        };
    }

    /**
     * Creates checkbox from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @return {Checkbox}
     */
    static fromJSON(json, templateAddress) {
        return new Checkbox({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            label: json.label,
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
        return 'Checkbox';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate(
                'systems/custom-system-builder/templates/_template/components/checkbox.html',
                existingComponent
            )
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
            throw new Error('Component key is mandatory for checkboxes');
        }

        fieldData.label = html.find('#checkboxLabel').val();
        fieldData.size = html.find('#checkboxSize').val();

        return fieldData;
    }
}

/**
 * @ignore
 */
export default Checkbox;
