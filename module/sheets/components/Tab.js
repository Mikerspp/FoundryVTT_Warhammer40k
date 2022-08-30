import Container from './Container.js';

/**
 * @ignore
 */
class Tab extends Container {
    /**
     * Tab name
     * @type {string}
     * @private
     */
    _name;

    /**
     * Tab constructor
     * @param {Object} data Component data
     * @param {string} [data.name=] Tab name
     * @param {string} data.key Tab key
     * @param {string|null} [data.tooltip] Tab tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {Array<Component>} [data.contents=[]] Container contents
     */
    constructor({ name = '', key, tooltip = null, templateAddress, contents = [], role = 0, permission = 0 }) {
        super({
            key: key,
            tooltip: tooltip,
            templateAddress: templateAddress,
            contents: contents,
            droppable: true,
            role: role,
            permission: permission
        });
        this._name = name;
    }

    /**
     * Tab name getter
     * @return {string}
     */
    get name() {
        return this._name;
    }

    /**
     * Renders component
     * @override
     * @param {CustomActor} actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<jQuery>} The jQuery element holding the component
     */
    async _getElement(actor, isEditable = true, options = {}) {
        let jQElement = await super._getElement(actor, isEditable, options);

        jQElement.addClass('tab');
        jQElement.attr('data-tab', this.key);
        jQElement.attr('data-group', 'primary');

        let mainPanelElement = $('<div></div>');
        mainPanelElement.addClass('flexcol flex-group-center');

        mainPanelElement.append(await this.renderContents(actor, isEditable));

        if (actor.isTemplate) {
            mainPanelElement.append(await this.renderTemplateControls(actor));
        }

        jQElement.append(mainPanelElement);
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
            name: this.name,
            type: 'tab'
        };
    }

    /**
     * Creates Tab from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @return {Tab}
     */
    static fromJSON(json, templateAddress) {
        return new Tab({
            name: json.name,
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            contents: componentFactory.createComponents(json.contents, templateAddress + '.contents'),
            role: json.role,
            permission: json.permission
        });
    }
}

/**
 * @ignore
 */
export default Tab;
