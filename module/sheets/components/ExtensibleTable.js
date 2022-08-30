import Container from './Container.js';
import templateFunctions from '../template-functions.js';

/**
 * ExtensibleTable abstract class
 * @abstract
 * @ignore
 */
class ExtensibleTable extends Container {
    /**
     * Table header should be bold
     * @type {boolean}
     * @protected
     */
    _head;

    /**
     * Row layout additional data
     * @type {{}}
     * @protected
     */
    _rowLayout;

    /**
     * Display warning on row delete
     * @type {boolean}
     * @protected
     */
    _deleteWarning;

    /**
     * Constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {boolean} [data.head=false] Table head should be bold ?
     * @param {Array<Component>} [data.contents=[]] Container contents
     * @param {Object} [data.rowLayout={}] Dynamic table row layout
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        head = false,
        contents = [],
        rowLayout = {},
        deleteWarning = false,
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
            role: role,
            permission: permission
        });
        this._head = head;
        this._rowLayout = rowLayout;
        this._deleteWarning = deleteWarning;
    }

    /**
     * Swaps two dynamic table elements
     * @param {Actor} actor
     * @param {Number} rowIdx1
     * @param {Number} rowIdx2
     * @private
     */
    _swapElements(actor, rowIdx1, rowIdx2) {
        let tableProps = foundry.utils.getProperty(actor.data.data.props, this.key);
        let tmpRow = {
            ...tableProps[rowIdx1]
        };

        tableProps[rowIdx1] = tableProps[rowIdx2];
        tableProps[rowIdx2] = tmpRow;

        actor.update({
            data: {
                props: actor.data.data.props
            }
        });
    }

    _deleteRow(actor, rowIdx) {
        let tableProps = foundry.utils.getProperty(actor.data.data.props, this.key);
        tableProps[rowIdx].deleted = true;

        actor.update({
            data: {
                props: actor.data.data.props
            }
        });
    }

    /**
     * Opens component editor
     * @param {CustomActor} actor Rendered actor
     * @param {Object} options Component options
     * @param {Object} [options.defaultValues] Component default values
     * @param {Array} [options.allowedComponents] Allowed components
     */
    openComponentEditor(actor, options = {}) {
        // Open dialog to edit new component
        templateFunctions.component(
            (action, component) => {
                // This is called on dialog validation
                this.addNewComponent(actor, component, options);
            },
            options.defaultValues,
            options.allowedComponents,
            true
        );
    }

    /**
     * Adds new component to container, handling rowLayout
     * @override
     * @param {CustomActor} actor
     * @param {Object|Array<Object>} component New component
     * @param {Object} options Component options
     * @param {Object} [options.defaultValues] Component default values
     * @param {Array} [options.allowedComponents] Allowed components
     */
    addNewComponent(actor, component, options = {}) {
        if (!Array.isArray(component)) {
            component = [component];
        }

        for (let aComp of component) {
            if (this._rowLayout[aComp.key]) {
                throw new Error("Component keys should be unique in the component's columns.");
            }
        }

        for (let aComponent of component) {
            // Add component
            this.contents.push(componentFactory.createComponents(aComponent));
            this._rowLayout[aComponent.key] = {
                align: aComponent.align,
                colName: aComponent.colName
            };
        }

        foundry.utils.setProperty(actor.data.data, this.templateAddress, this.toJSON());

        actor.update({
            data: {
                header: actor.data.data.header,
                body: actor.data.data.body
            }
        });
    }

    /**
     * Returns serialized component
     * @override
     * @return {Object}
     */
    toJSON() {
        let jsonObj = super.toJSON();

        let rowLayout = [];

        for (let component of jsonObj.contents) {
            rowLayout.push({
                ...component,
                align: this._rowLayout?.[component.key].align ?? 'left',
                colName: this._rowLayout?.[component.key].colName ?? ''
            });
        }

        delete jsonObj.contents;

        return {
            ...jsonObj,
            rowLayout: rowLayout,
            head: this._head,
            deleteWarning: this._deleteWarning
        };
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

        fieldData.head = html.find('#tableHead').is(':checked');
        fieldData.deleteWarning = html.find('#tableDeleteWarning').is(':checked');

        return fieldData;
    }
}

/**
 * @ignore
 */
export default ExtensibleTable;
