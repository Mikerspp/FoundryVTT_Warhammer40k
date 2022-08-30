import InputComponent from './InputComponent.js';
import { encodeHTMLEntities } from '../../utils.js';

/**
 * NumberField component
 * @ignore
 */
class NumberField extends InputComponent {
    /**
     * Allows for decimal numbers
     * @type {boolean}
     * @private
     */
    _allowDecimal;

    /**
     * Min value
     * Can be a Number or a Formula
     * @type {String}
     * @private
     */
    _minVal;

    /**
     * Max value
     * Can be a Number or a Formula
     * @type {String}
     * @private
     */
    _maxVal;

    /**
     * If value can be changed by relative operations
     * @type {boolean}
     * @private
     */
    _allowRelative;

    /**
     * Whether to show controls on render
     * @type {boolean}
     * @private
     */
    _showControls;

    /**
     * Text field constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {boolean} [data.allowDecimal=false] Allows for decimal numbers
     * @param {string|null} [data.minVal=null] Number field min value
     * @param {string|null} [data.maxVal=null] Number field max value
     * @param {boolean} [data.allowRelative=true] If value can be changed by relative operations
     * @param {boolean} [data.showControls=false] Whether to show controls on render
     * @param {string|null} [data.label=null] Field label
     * @param {string|null} [data.defaultValue=null] Field default value
     * @param {string|null} [data.size=null] Field size. Can be full-size, small, medium or large.
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        allowDecimal = false,
        minVal = null,
        maxVal = null,
        allowRelative = true,
        showControls = false,
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
            label: label,
            defaultValue: defaultValue,
            size: size,
            cssClass: cssClass,
            role: role,
            permission: permission
        });
        this._allowDecimal = allowDecimal;
        this._minVal = minVal;
        this._maxVal = maxVal;
        this._allowRelative = allowRelative;
        this._showControls = showControls;
    }

    _getMinVal(actor) {
        let min = -Infinity;

        if (this._minVal) {
            min = Number(this._minVal);
            if (Number.isNaN(min)) {
                min = Number(
                    ComputablePhrase.computeMessageStatic(this._minVal, actor.data.data.props, {
                        reference: this.key,
                        defaultValue: '0'
                    }).result
                );
            }

            if (Number.isNaN(min)) {
                min = -Infinity;
            }
        }

        return min;
    }

    _getMaxVal(actor) {
        let max = Infinity;

        if (this._maxVal) {
            max = Number(this._maxVal);
            if (Number.isNaN(max)) {
                max = Number(
                    ComputablePhrase.computeMessageStatic(this._maxVal, actor.data.data.props, {
                        reference: this.key,
                        defaultValue: '0'
                    }).result
                );
            }

            if (Number.isNaN(max)) {
                max = Infinity;
            }
        }

        return max;
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
        jQElement.addClass('custom-system-number-field');

        let fieldSpan = $('<span></span>');
        fieldSpan.addClass('custom-system-number-input-span');

        let hiddenInputElement = $('<input />');
        hiddenInputElement.attr('type', 'hidden');

        if (!actor.isTemplate) {
            hiddenInputElement.attr('name', 'data.props.' + this.key);
        }

        let inputElement = $('<input />');
        inputElement.attr('type', 'text');
        inputElement.attr('id', this.key);

        if (!isEditable) {
            hiddenInputElement.attr('disabled', 'disabled');
            inputElement.attr('disabled', 'disabled');
        }

        hiddenInputElement.val(foundry.utils.getProperty(actor.data.data.props, this.key) ?? this.defaultValue ?? '');
        inputElement.val(hiddenInputElement.val());

        const persistValue = () => {
            let newValue = inputElement.val();
            let oldValue = hiddenInputElement.val();

            if (isNaN(Number(newValue))) {
                newValue = oldValue;
                ui.notifications.warn('Value must be numeric');
            } else {
                if (!this._allowDecimal && !Number.isInteger(Number(newValue))) {
                    newValue = oldValue;
                    ui.notifications.warn('Value must be an integer');
                }

                if (this._allowRelative && (newValue.startsWith('+') || newValue.startsWith('-'))) {
                    newValue = Number(oldValue) + Number(newValue);
                }

                newValue = Number(newValue);

                let min = this._getMinVal(actor);
                if (newValue < min) {
                    newValue = min;
                    ui.notifications.warn('Value must be greater than ' + min);
                }

                let max = this._getMaxVal(actor);
                if (newValue > max) {
                    newValue = max;
                    ui.notifications.warn('Value must be smaller than ' + max);
                }
            }

            inputElement.val(newValue);

            if (newValue !== oldValue) {
                hiddenInputElement.val(newValue).trigger('change');
            }
        };

        inputElement
            .on('focus', () => {
                inputElement.trigger('select');
            })
            .on('blur', persistValue);

        if (this._showControls && !actor.isTemplate && isEditable) {
            let minusButton = $('<button type="button"></button >');
            minusButton.append('<i class="fa fa-minus"></i>');
            minusButton.addClass('custom-system-number-field-control custom-system-number-field-control-minus');
            minusButton.on('click', () => {
                inputElement.val(Math.max(Number(inputElement.val()) - 1, this._getMinVal(actor)));
            });
            minusButton.hide();

            let plusButton = $('<button type="button"></button >');
            plusButton.append('<i class="fa fa-plus"></i>');
            plusButton.addClass('custom-system-number-field-control custom-system-number-field-control-plus');
            plusButton.on('click', () => {
                inputElement.val(Math.min(Number(inputElement.val()) + 1, this._getMaxVal(actor)));
            });
            plusButton.hide();

            fieldSpan.append(minusButton);
            fieldSpan.append(hiddenInputElement);
            fieldSpan.append(inputElement);
            fieldSpan.append(plusButton);

            fieldSpan
                .on('mouseover', () => {
                    if (inputElement.width() < 60) {
                        minusButton.addClass('custom-system-number-field-control-outer');
                        plusButton.addClass('custom-system-number-field-control-outer');
                    } else {
                        minusButton.removeClass('custom-system-number-field-control-outer');
                        plusButton.removeClass('custom-system-number-field-control-outer');
                    }

                    minusButton.show();
                    plusButton.show();
                })
                .on('mouseleave', () => {
                    minusButton.hide();
                    plusButton.hide();
                    if (!inputElement.is(':focus')) {
                        persistValue();
                    }
                });
            jQElement.append(fieldSpan);
        } else {
            jQElement.append(inputElement);
            jQElement.append(hiddenInputElement);
        }

        if (actor.isTemplate) {
            jQElement.addClass('custom-system-editable-component');
            inputElement.attr('readonly', 'readonly');

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
            allowDecimal: this._allowDecimal,
            minVal: this._minVal,
            maxVal: this._maxVal,
            allowRelative: this._allowRelative,
            showControls: this._showControls,
            type: 'numberField'
        };
    }

    /**
     * Creates TextField from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @return {NumberField}
     */
    static fromJSON(json, templateAddress) {
        return new NumberField({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            allowDecimal: json.allowDecimal,
            minVal: json.minVal,
            maxVal: json.maxVal,
            allowRelative: json.allowRelative,
            showControls: json.showControls,
            label: json.label,
            defaultValue: json.defaultValue,
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
        return 'Number field';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate(
                'systems/custom-system-builder/templates/_template/components/numberField.html',
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
            throw new Error('Component key is mandatory for number fields');
        }

        fieldData.label = html.find('#numberFieldLabel').val();
        fieldData.defaultValue = html.find('#numberFieldValue').val();
        fieldData.size = html.find('#numberFieldSize').val();
        fieldData.allowDecimal = html.find('#numberFieldAllowDecimal').is(':checked');
        fieldData.minVal = html.find('#numberFieldMinVal').val();
        fieldData.maxVal = html.find('#numberFieldMaxVal').val();
        fieldData.allowRelative = html.find('#numberFieldAllowRelative').is(':checked');
        fieldData.showControls = html.find('#numberFieldShowControls').is(':checked');

        return fieldData;
    }
}

/**
 * @ignore
 */
export default NumberField;
