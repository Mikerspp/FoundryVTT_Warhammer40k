import ExtensibleTable from './ExtensibleTable.js';

/**
 * DynamicTable component
 * @ignore
 */
class DynamicTable extends ExtensibleTable {
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
            head: head,
            rowLayout: rowLayout,
            deleteWarning: deleteWarning,
            role: role,
            permission: permission
        });
    }

    /**
     * Renders component
     * @override
     * @param {CustomActor} actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(actor, isEditable = true, options) {
        let sampleNewRow = { deleted: false };

        let baseElement = await super._getElement(actor, isEditable, options);

        let jQElement = $('<table></table>');

        let tableBody = $('<tbody></tbody>');
        let firstRow = $('<tr></tr>');

        for (let component of this._contents) {
            let cell = $('<td></td>');
            cell.addClass('custom-system-cell');

            switch (this._rowLayout[component.key].align) {
                case 'center':
                    cell.addClass('custom-system-cell-alignCenter');
                    break;
                case 'right':
                    cell.addClass('custom-system-cell-alignRight');
                    break;
                case 'left':
                default:
                    cell.addClass('custom-system-cell-alignLeft');
                    break;
            }

            if (this._head) {
                cell.addClass('custom-system-cell-boldTitle');
            }

            cell.append(this._rowLayout[component.key].colName);

            sampleNewRow[component.key] = component?.defaultValue ?? null;

            if (actor.isTemplate) {
                cell.addClass('custom-system-editable-component');
                cell.append(' {' + component.key + '}');
                cell.on('click', () => {
                    component.editComponent(actor, this._rowLayout[component.key]);
                });
            }

            firstRow.append(cell);
        }

        let headControlsRow = $('<td></td>');

        if (actor.isTemplate) {
            headControlsRow.addClass('custom-system-cell custom-system-cell-alignRight');
            headControlsRow.append(
                await this.renderTemplateControls(actor, {
                    isDynamicTable: true
                })
            );
        }

        firstRow.append(headControlsRow);
        tableBody.append(firstRow);

        if (!actor.isTemplate) {
            let relevantRows = [];
            let dynamicProps = foundry.utils.getProperty(actor.data.data.props, this.key);
            for (let rowIndex in dynamicProps) {
                if (dynamicProps.hasOwnProperty(rowIndex) && !dynamicProps[rowIndex]?.deleted) {
                    relevantRows.push(parseInt(rowIndex));
                }
            }
            relevantRows = relevantRows.sort(function (a, b) {
                return a - b;
            });

            for (let [index, line] of relevantRows.entries()) {
                let tableRow = $('<tr></tr>');
                tableRow.addClass('custom-system-dynamicRow');

                for (let component of this.contents) {
                    let cell = $('<td></td>');
                    cell.addClass('custom-system-cell');

                    switch (this._rowLayout[component.key].align) {
                        case 'center':
                            cell.addClass('custom-system-cell-alignCenter');
                            break;
                        case 'right':
                            cell.addClass('custom-system-cell-alignRight');
                            break;
                        case 'left':
                        default:
                            cell.addClass('custom-system-cell-alignLeft');
                            break;
                    }

                    let newCompJson = component.toJSON();
                    newCompJson.key = `${this.key}.${line}.${component.key}`;

                    cell.append(await componentFactory.createComponents(newCompJson).render(actor, isEditable));

                    tableRow.append(cell);
                }

                let controlCell = $('<td></td>');
                let controlDiv = $('<div></div>');
                controlDiv.addClass('custom-system-dynamic-table-row-icons');

                let sortSpan = $('<span></span>');
                sortSpan.addClass('custom-system-dynamic-table-sort-icon-wrapper');

                if (isEditable && line !== relevantRows[0]) {
                    let sortUpLink = $(
                        '<a><i class="fas fa-sort-up custom-system-dynamic-table-sort-icon custom-system-sortUpDynamicLine custom-system-clickable"></i></a>'
                    );
                    sortSpan.append(sortUpLink);

                    sortUpLink.on('click', () => {
                        if (index !== 0) {
                            this._swapElements(actor, relevantRows[index - 1], relevantRows[index]);
                        }
                    });
                }

                if (isEditable && line !== relevantRows[relevantRows.length - 1]) {
                    let sortDownLink = $(
                        '<a><i class="fas fa-sort-down custom-system-dynamic-table-sort-icon custom-system-sortDownDynamicLine custom-system-clickable"></i></a>'
                    );
                    sortSpan.append(sortDownLink);

                    sortDownLink.on('click', () => {
                        if (index !== relevantRows.length - 1) {
                            this._swapElements(actor, relevantRows[index + 1], relevantRows[index]);
                        }
                    });
                }

                controlDiv.append(sortSpan);
                if (isEditable) {
                    let deleteLink = $(
                        '<a><i class="fas fa-trash custom-system-deleteDynamicLine custom-system-clickable"></i></a>'
                    );
                    if (this._deleteWarning) {
                        deleteLink.on('click', () => {
                            Dialog.confirm({
                                title: 'Delete row',
                                content: '<p>Are you sure you want to delete this row ?</p>',
                                yes: () => {
                                    this._deleteRow(actor, line);
                                },
                                no: () => {}
                            });
                        });
                    } else {
                        deleteLink.on('click', () => {
                            this._deleteRow(actor, line);
                        });
                    }
                    controlDiv.append(deleteLink);
                }
                controlCell.append(controlDiv);

                tableRow.append(controlCell);
                tableBody.append(tableRow);
            }

            if (isEditable) {
                let addRow = $('<tr></tr>');
                let fillCell = $('<td></td>');
                fillCell.attr('colspan', this.contents.length);

                let addButtonCell = $('<td></td>');
                let addButton = $(
                    '<a><i class="fas fa-plus-circle custom-system-addDynamicLine custom-system-clickable"></i></a>'
                );
                addButton.on('click', () => {
                    let tableProps = foundry.utils.getProperty(actor.data.data.props, this.key) ?? {};
                    let newIndex = relevantRows.length ? parseInt(relevantRows[relevantRows.length - 1]) + 1 : 0;

                    tableProps[newIndex] = { ...sampleNewRow };
                    foundry.utils.setProperty(actor.data.data.props, this.key, tableProps);

                    actor.update({
                        data: {
                            props: actor.data.data.props
                        }
                    });
                });

                addButtonCell.append(addButton);

                addRow.append(fillCell);
                addRow.append(addButtonCell);
                tableBody.append(addRow);
            }
        }

        if (actor.isTemplate) {
            let templateHead = $('<thead></thead>');
            let headRow = $('<tr></tr>');
            let headCell = $('<th></th>');

            headCell.addClass('custom-system-cell-alignCenter custom-system-editable-component');
            headCell.attr('colspan', this.contents.length ? this.contents.length + 1 : 1);
            headCell.text('Dynamic table ' + this.key);

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
     * Returns serialized component
     * @override
     * @return {Object}
     */
    toJSON() {
        let jsonObj = super.toJSON();

        return {
            ...jsonObj,
            type: 'dynamicTable'
        };
    }

    /**
     * Creates DynamicTable from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @return {DynamicTable}
     */
    static fromJSON(json, templateAddress) {
        let rowContents = [];
        let rowLayout = {};

        for (let [index, componentDesc] of (json.rowLayout ?? []).entries()) {
            let component = componentFactory.createComponents(componentDesc, templateAddress + '.rowLayout.' + index);
            rowContents.push(component);
            rowLayout[component.key] = {
                align: componentDesc.align,
                colName: componentDesc.colName
            };
        }

        return new DynamicTable({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            head: json.head,
            deleteWarning: json.deleteWarning,
            contents: rowContents,
            rowLayout: rowLayout,
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
        return 'Dynamic Table';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate(
                'systems/custom-system-builder/templates/_template/components/dynamicTable.html',
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
            throw new Error('Component key is mandatory for ' + this.getPrettyName());
        }

        return fieldData;
    }
}

/**
 * @ignore
 */
export default DynamicTable;
