import templateFunctions from '../template-functions.js';

/**
 * Abstract component class
 * @abstract
 */
class Component {
    /**
     * Component key
     * @type {string}
     * @private
     */
    _key;

    /**
     * Component address in template definition
     * @type {string}
     * @private
     */
    _templateAddress;

    /**
     * Component css class
     * @type {string|null}
     * @private
     */
    _cssClass;

    /**
     * Component minimum role
     * @type {Number}
     * @private
     */
    _role;

    /**
     * Component minimum permission
     * @type {Number}
     * @private
     */
    _permission;

    /**
     * Component tooltip
     * @type {string|null}
     * @private
     */
    _tooltip;

    /**
     * Component constructor
     * @constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     * @param {Number} [data.role=0] Component minimum role
     * @param {Number} [data.permission=0] Component minimum permission
     * @param {string|null} [data.tooltip=null] Component minimum permission
     */
    constructor({ key, templateAddress, cssClass = null, role = 0, permission = 0, tooltip = null }) {
        if (this.constructor === Component) {
            throw new TypeError('Abstract class "Component" cannot be instantiated directly');
        }
        this._key = key;
        this._templateAddress = templateAddress;
        this._cssClass = cssClass;
        this._role = role;
        this._permission = permission;
        this._tooltip = tooltip;
    }

    /**
     * Component key
     * @return {string}
     */
    get key() {
        return this._key;
    }

    /**
     * Component tooltip
     * @return {string}
     */
    get tooltip() {
        return this._tooltip;
    }

    /**
     * Component address in template, i.e. component path from actor.data.data object
     * @return {string}
     */
    get templateAddress() {
        return this._templateAddress;
    }

    /**
     * Additional CSS class
     * @return {string|null}
     */
    get cssClass() {
        return this._cssClass;
    }

    /**
     * Component minimum role
     * @return {Number}
     */
    get role() {
        return this._role;
    }

    /**
     * Component minimum permission
     * @return {Number}
     */
    get permission() {
        return this._permission;
    }

    canBeRendered(actor) {
        return game.user.role >= this.role && actor.permission >= this.permission;
    }

    /**
     * @param {CustomActor} actor Rendered actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @param {Object} [options={}] Additional options usable by the final Component
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async render(actor, isEditable = true, options = {}) {
        if (this.canBeRendered(actor)) {
            return this._getElement(actor, isEditable, options);
        } else {
            return $('<div></div>');
        }
    }

    /**
     * @abstract
     * @param {CustomActor} actor Rendered actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @param {Object} [options={}] Additional options usable by the final Component
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(actor, isEditable = true, options = {}) {
        let jQElement = $('<div></div>');
        jQElement.addClass(this.key);
        jQElement.addClass(this.cssClass);

        if (this.tooltip) {
            jQElement.attr('title', this.tooltip);
        }

        return jQElement;
    }

    /**
     * Handles component editor dialog
     * @param {CustomActor} actor Current template
     * @param {Object|null} [dynamicTableAttributes=null]
     * @param {string} dynamicTableAttributes.align
     * @param {string} dynamicTableAttributes.colName
     * @param {Array<String>|null} allowedComponents Allowed component types
     */
    editComponent(actor, dynamicTableAttributes = null, allowedComponents = null) {
        let componentJSON = this.toJSON();
        if (dynamicTableAttributes) {
            componentJSON = foundry.utils.mergeObject(componentJSON, dynamicTableAttributes);
        }

        // Open dialog to edit component
        templateFunctions.component(
            (action, component) => {
                // This is called on dialog validation

                // Dialog has many buttons, clicked button is returned in action
                // New component data is returns in component

                // If we edit the component
                if (action === 'edit') {
                    this.edit(actor, component, dynamicTableAttributes !== null);
                } else if (action === 'delete') {
                    this.delete(actor);
                } else if (action === 'sortUp') {
                    this.sortUpInParent(actor);
                } else if (action === 'sortDown') {
                    this.sortDownInParent(actor);
                }
            },
            componentJSON,
            allowedComponents,
            dynamicTableAttributes !== null
        );
    }

    /**
     * Saves component in database
     * @param {CustomActor} actor Current template
     */
    save(actor) {
        actor.update({
            data: {
                header: actor.data.data.header,
                body: actor.data.data.body
            }
        });
    }

    /**
     * Edits component
     * @param {CustomActor} actor Current template
     * @param {Object} data Diff data
     * @param {boolean} isDynamicTable Is the popup called from a dynamic table ?
     */
    edit(actor, data, isDynamicTable) {
        let newComponent = foundry.utils.mergeObject(this.toJSON(), data);
        if (newComponent.key !== this.key && !isDynamicTable && actor.getKeys().has(newComponent.key)) {
            throw new Error('Component keys should be unique in the template.');
        }

        foundry.utils.setProperty(actor.data.data, this.templateAddress, newComponent);

        // After actions have been taken care of, save actor
        this.save(actor);
    }

    /**
     * Deletes component
     * @param {CustomActor} actor Current template
     */
    delete(actor) {
        foundry.utils.setProperty(actor.data.data, this.templateAddress, null);

        // Get the component's parent type
        let splitPath = this.templateAddress.split('.');
        splitPath.pop();
        let parent = foundry.utils.getProperty(actor.data.data, splitPath.join('.'));

        // If not a table, we remove every null in contents
        if (!Number.isInteger(parseInt(splitPath.pop()))) {
            let len = parent.length;
            for (let i = 0; i < len; i++) {
                parent[i] && parent.push(parent[i]); // copy non-empty values to the end of the array
            }

            parent.splice(0, len);
        }

        // After actions have been taken care of, save actor
        this.save(actor);
    }

    /**
     * Sort before in the same container
     * @param {CustomActor} actor Current template
     */
    sortUpInParent(actor) {
        // Get part
        let part = foundry.utils.getProperty(actor.data.data, this.templateAddress);

        let splitPath = this.templateAddress.split('.');
        let partIndex = splitPath.pop();

        let parent = foundry.utils.getProperty(actor.data.data, splitPath.join('.'));
        let idx = parseInt(partIndex);

        if (idx > 0) {
            parent[idx] = parent[idx - 1];
            parent[idx - 1] = part;
        }

        // After actions have been taken care of, save actor
        this.save(actor);
    }

    /**
     * Sort after in the same container
     * @param {CustomActor} actor Current template
     */
    sortDownInParent(actor) {
        // Get part
        let part = foundry.utils.getProperty(actor.data.data, this.templateAddress);

        let splitPath = this.templateAddress.split('.');
        let partIndex = splitPath.pop();

        let parent = foundry.utils.getProperty(actor.data.data, splitPath.join('.'));
        let idx = parseInt(partIndex);

        if (idx < parent.length - 1) {
            parent[idx] = parent[idx + 1];
            parent[idx + 1] = part;
        }

        // After actions have been taken care of, save actor
        this.save(actor);
    }

    /**
     * Returns serialized component
     * @return {Object}
     */
    toJSON() {
        return {
            key: this.key,
            cssClass: this.cssClass,
            role: this.role,
            permission: this.permission,
            tooltip: this.tooltip
        };
    }

    /**
     * Creates a new component from a JSON description
     * @abstract
     * @param {Object} json Component description
     * @param {string} templateAddress Component address in template, i.e. component path from actor.data.data object
     * @return Component The new component
     * @throws {Error} If not implemented
     */
    static fromJSON(json, templateAddress) {
        throw new Error('You must implement this function');
    }

    /**
     * Gets pretty name for this component's type
     * @abstract
     * @return {string} The pretty name
     * @throws {Error} If not implemented
     */
    static getPrettyName() {
        throw new Error('You must implement this function');
    }

    /**
     * Get configuration form for component creation / edition
     * @abstract
     * @param {Object} existingComponent Basic description of the existing component to pre-fill the form
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     * @throws {Error} If not implemented
     */
    static async getConfigForm(existingComponent) {
        throw new Error('You must implement this function');
    }

    /**
     * Extracts configuration from submitted HTML form
     * @abstract
     * @param {JQuery<HTMLElement>} html The submitted form
     * @return {Object} The basic representation of the component
     * @throws {Error} If configuration is not correct
     */
    static extractConfig(html) {
        let fieldData = {};

        // Fetch fields existing for every type of components
        let genericFields = html.find(
            '.custom-system-component-generic-fields input, .custom-system-component-generic-fields select, .custom-system-component-generic-fields textarea'
        );

        // Store their value in an object
        for (let field of genericFields) {
            let jQField = $(field);
            fieldData[jQField.data('key')] = jQField.val();
        }

        if (fieldData.key && !fieldData.key.match(/^[a-zA-Z0-9_]+$/)) {
            throw new Error(
                'Component key must be a string composed of upper and lowercase letters and underscores only.'
            );
        }

        return fieldData;
    }
}

/**
 * @ignore
 */
export default Component;
