import Component from './Component.js';

/**
 * Abstract class for Components which serve as inputs
 * @abstract
 */
class InputComponent extends Component {
    /**
     * Component label
     * @type {string|null}
     * @private
     */
    _label;

    /**
     * Component default value
     * @type {string|null}
     * @private
     */
    _defaultValue;

    /**
     * Component size
     * @type {string|null}
     * @private
     */
    _size;

    /**
     * Constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {string|null} [data.label=null] Field label
     * @param {string|null} [data.defaultValue=null] Field default value
     * @param {string|null} [data.size=null] Field size. Can be full-size, small, medium or large.
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        label = null,
        defaultValue = null,
        size = null,
        cssClass = null,
        role = 0,
        permission = 0
    }) {
        super({
            key: key,
            tooltip: tooltip,
            templateAddress: templateAddress,
            cssClass: cssClass,
            role: role,
            permission: permission
        });

        if (this.constructor === InputComponent) {
            throw new TypeError('Abstract class "DataComponent" cannot be instantiated directly');
        }

        this._label = label;
        this._defaultValue = defaultValue;
        this._size = size;
    }

    /**
     * Field label
     * @return {string|null}
     */
    get label() {
        return this._label;
    }

    /**
     * Field default value
     * @return {string|null}
     */
    get defaultValue() {
        return this._defaultValue;
    }

    /**
     * Field size
     * @return {string|null}
     */
    get size() {
        return this._size;
    }

    /**
     * Renders the outer part of an input component, including the label if exists
     * @param {CustomActor} actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(actor, isEditable = true, options) {
        let jQElement = await super._getElement(actor, isEditable, options);
        jQElement.addClass(
            'custom-system-field custom-system-field-root custom-system-field-' + (this.size ?? 'full-size')
        );

        if (this.label) {
            let label = $('<label></label>');
            label.attr('for', this.key);
            label.text(this.label);
            jQElement.append(label);
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
            label: this.label,
            defaultValue: this.defaultValue,
            size: this.size
        };
    }
}

/**
 * @ignore
 */
export default InputComponent;
