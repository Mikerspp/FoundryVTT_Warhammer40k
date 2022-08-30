import Label from './Label.js';
import templateFunctions from '../template-functions.js';
import Container from './Container.js';

/**
 * Table component
 * @ignore
 */
class Table extends Container {
    /**
     * Column count
     * @type {Number}
     * @private
     */
    _cols;

    /**
     * Row count
     * @type {Number}
     * @private
     */
    _rows;

    /**
     * Table layout
     * @type {string|null}
     * @private
     */
    _layout;

    /**
     * Table contents
     * @override
     * @type {Array<Array<Component>>}
     * @private
     */
    _contents;

    /**
     * Constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {Number} [data.cols=1] Column count
     * @param {Number} [data.rows=1] Row count
     * @param {string|null} [data.layout=null] Table layout
     * @param {Array<Array<Component>>} [data.contents=[]] Container contents
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        cols = 1,
        rows = 1,
        layout = null,
        contents = [],
        cssClass = null,
        role = 0,
        permission = 0
    }) {
        super({
            key: key,
            tooltip: tooltip,
            templateAddress: templateAddress,
            contents: [],
            cssClass: cssClass,
            droppable: true,
            role: role,
            permission: permission
        });
        this._cols = cols;
        this._rows = rows;
        this._layout = layout;
        this._contents = contents;
    }

    /**
     * contents getter
     * @override
     * @return {Array<Array<Component>>}
     */
    get contents() {
        return this._contents;
    }

    /**
     * Renders component
     * @override
     * @param {CustomActor} actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(actor, isEditable = true, options = {}) {
        let baseElement = await super._getElement(actor, isEditable, options);

        let jQElement = $('<table></table>');
        let tableBody = $('<tbody></tbody>');

        for (let rowNum = 0; rowNum < this._rows; rowNum++) {
            let tableRow = $('<tr></tr>');
            for (let colNum = 0; colNum < this._cols; colNum++) {
                let cellAlignment = this._layout ? this._layout.substr(colNum, 1) : 'l';

                let cellClass;
                switch (cellAlignment) {
                    case 'c':
                        cellClass = 'custom-system-cell-alignCenter';
                        break;
                    case 'r':
                        cellClass = 'custom-system-cell-alignRight';
                        break;
                    case 'l':
                    default:
                        cellClass = 'custom-system-cell-alignLeft';
                        break;
                }

                let cell = $('<td></td>');
                cell.addClass(cellClass);
                cell.addClass('custom-system-cell');

                if (this.contents?.[rowNum]?.[colNum]) {
                    cell.append(await this.contents[rowNum][colNum].render(actor, isEditable));
                } else {
                    if (actor.isTemplate) {
                        cell.append(await this.renderTemplateControls(actor, { rowNum, colNum }));
                    } else {
                        cell.append(
                            await new Label({
                                key: null,
                                icon: null,
                                value: '',
                                rollMessage: null,
                                style: null,
                                size: 'full-size'
                            }).render(actor)
                        );
                    }
                }

                tableRow.append(cell);
            }
            tableBody.append(tableRow);
        }

        if (actor.isTemplate) {
            let templateHead = $('<thead></thead>');
            let headRow = $('<tr></tr>');
            let headCell = $('<th></th>');

            headCell.addClass('custom-system-cell-alignCenter custom-system-editable-component');
            headCell.attr('colspan', this._cols);
            headCell.text('Table ' + this.key);

            headRow.append(headCell);
            templateHead.append(headRow);

            templateHead.on('click', () => {
                this.editComponent(actor);
            });

            jQElement.append(templateHead);
        }

        jQElement.append(tableBody);

        baseElement.append(jQElement);
        return baseElement;
    }

    /**
     * Opens component editor
     * @param {CustomActor} actor Rendered actor
     * @param {Object} options Component options
     * @param {Number} options.rowNum New component's row number
     * @param {Number} options.colNum New component's col number
     */
    openComponentEditor(actor, { rowNum, colNum }) {
        // Open dialog to edit new component
        templateFunctions.component((action, component) => {
            // This is called on dialog validation
            this.addNewComponent(actor, component, { rowNum, colNum });
        });
    }

    /**
     * Adds new component to container, handling rowLayout
     * @override
     * @param {CustomActor} actor
     * @param {Object|Array<Object>} component
     * @param {Object} options Component data
     * @param {Number} options.rowNum New component's row number
     * @param {Number} options.colNum New component's col number
     */
    addNewComponent(actor, component, { rowNum, colNum }) {
        // Add component
        if (!this._contents[rowNum]) {
            this._contents[rowNum] = [];
        }

        if (Array.isArray(component)) {
            for (let aComp of component) {
                if (actor.getKeys().has(aComp.key)) {
                    throw new Error('Component keys should be unique in the template.');
                }
            }
        } else {
            if (actor.getKeys().has(component.key)) {
                throw new Error('Component keys should be unique in the template.');
            }
        }

        if (Array.isArray(component) && component.length > 1) {
            component = {
                type: 'panel',
                contents: component
            };
        }

        this._contents[rowNum][colNum] = componentFactory.createComponents(component);

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

        let tableContents = [];
        for (let row of this.contents ?? []) {
            if (!Array.isArray(row)) {
                row = [];
            }

            let rowContents = [];
            for (let component of row) {
                rowContents.push(component?.toJSON() ?? null);
            }
            tableContents.push(rowContents);
        }

        return {
            ...jsonObj,
            cols: this._cols,
            rows: this._rows,
            layout: this._layout,
            contents: tableContents,
            type: 'table'
        };
    }

    /**
     * Creates Table from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @return {Table}
     */
    static fromJSON(json, templateAddress) {
        let tableContents = [];
        for (let [index, row] of (json.contents ?? []).entries()) {
            tableContents.push(componentFactory.createComponents(row, templateAddress + '.contents.' + index));
        }
        return new Table({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            cols: json.cols,
            rows: json.rows,
            layout: json.layout,
            contents: tableContents,
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
        return 'Table';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate(
                'systems/custom-system-builder/templates/_template/components/table.html',
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

        fieldData.rows = html.find('#tableRows').val();
        fieldData.cols = html.find('#tableCols').val();
        fieldData.layout = html.find('#tableLayout').val();

        return fieldData;
    }
}

/**
 * @ignore
 */
export default Table;
