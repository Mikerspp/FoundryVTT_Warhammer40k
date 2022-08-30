import Container from './Container.js';

/**
 * Panel component
 * @ignore
 */
class Panel extends Container {
    /**
     * Panel flow
     * @type {string|null}
     * @private
     */
    _flow;

    /**
     * Panel alignment
     * @type {string|null}
     * @private
     */
    _align;

    /**
     * Constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {string|null} [data.flow=null] Panel flow
     * @param {string|null} [data.align=null] Panel alignment
     * @param {Array<Component>} [data.contents=[]] Container contents
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        flow = null,
        align = null,
        contents = [],
        cssClass = null,
        role = 0,
        permission = 0
    }) {
        super({
            key: key,
            tooltip: tooltip,
            templateAddress: templateAddress,
            contents: contents,
            cssClass: cssClass,
            droppable: true,
            role: role,
            permission: permission
        });
        this._flow = flow;
        this._align = align;
    }

    /**
     * Renders component
     * @override
     * @param {CustomActor|CustomItem} actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(actor, isEditable = true, options = {}) {
        let jQElement = await super._getElement(actor, isEditable, options);

        let layoutClass = '';

        switch (this._flow) {
            case 'vertical':
                layoutClass = '';
                break;
            case 'horizontal':
                layoutClass = 'flexrow';
                break;
            default:
                if (/^grid-([1-9]$|1[0-2]$)/.test(this._flow)) {
                    layoutClass = 'grid grid-' + this._flow.substr(5) + 'col';
                }
                break;
        }
        jQElement.addClass(layoutClass);

        let alignClass;
        switch (this._align) {
            case 'center':
                alignClass = 'flex-group-center';
                break;
            case 'left':
                alignClass = 'flex-group-left';
                break;
            case 'right':
                alignClass = 'flex-group-right';
                break;
            case 'justify':
                alignClass = 'flex-between';
                break;
            default:
                alignClass = '';
                break;
        }
        jQElement.addClass(alignClass);

        jQElement.addClass('custom-system-panel');

        jQElement.append(await this.renderContents(actor, isEditable));

        if (actor.isTemplate) {
            jQElement.append(await this.renderTemplateControls(actor));

            if (this.templateAddress !== 'body' && this.templateAddress !== 'header') {
                let templateWrapper = $('<div></div>');
                templateWrapper.addClass('custom-system-editable-panel');

                let panelTitle = $('<div></div>');
                panelTitle.addClass('custom-system-editable-panel-title custom-system-editable-component');
                panelTitle.text('Panel ' + this.key);

                panelTitle.on('click', () => {
                    this.editComponent(actor);
                });

                templateWrapper.append(panelTitle);
                templateWrapper.append(jQElement);

                jQElement = templateWrapper;
            }
        } else {
            let panelWrapper = $('<div></div>');
            panelWrapper.append(jQElement);

            jQElement = panelWrapper;
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
            flow: this._flow,
            align: this._align,
            type: 'panel'
        };
    }

    /**
     * Creates Panel from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @return {Panel}
     */
    static fromJSON(json, templateAddress) {
        return new Panel({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            flow: json.flow,
            align: json.align,
            contents: componentFactory.createComponents(json.contents, templateAddress + '.contents'),
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
        return 'Panel';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate(
                'systems/custom-system-builder/templates/_template/components/panel.html',
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

        fieldData.flow = html.find('#panelFlow').val();
        fieldData.align = html.find('#panelAlign').val();

        return fieldData;
    }
}

/**
 * @ignore
 */
export default Panel;
