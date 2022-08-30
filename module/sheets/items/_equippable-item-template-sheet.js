import templateFunctions from '../template-functions.js';
import { EquippableItemSheet } from './equippable-item-sheet.js';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {CustomActorSheet}
 * @ignore
 */
export class EquippableItemTemplateSheet extends EquippableItemSheet {
    /* -------------------------------------------- */

    /** @override */
    async getData() {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = await super.getData();

        // Prepare character data and items.
        await this._prepareSheetData(context);

        return context;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // -------------------------------------------------------------
        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        // Edit hidden attributes
        html.find('.custom-system-configure-attributes').click((ev) => {
            // Open the dialog for edition
            templateFunctions.attributes((newAttributes) => {
                // This is called on dialog validation

                // Update the actor with new hidden attributes
                this.item
                    .update({
                        data: {
                            hidden: newAttributes
                        }
                    })
                    .then(() => {
                        this.render(false);
                    });
            }, this.item.data.data.hidden);
        });

        // Edit display settings
        html.find('.custom-system-configure-display').click((ev) => {
            // Open the dialog for edition
            templateFunctions.displaySettings((displaySettings) => {
                // This is called on dialog validation

                // Update the actor with new hidden attributes
                this.item
                    .update({
                        data: {
                            display: displaySettings
                        }
                    })
                    .then(() => {
                        this.render(false);
                    });
            }, this.item.data.data.display);
        });

        // Reload all sheets
        html.find('.custom-system-reload-all-sheets').click((ev) => {
            Dialog.confirm({
                title: 'Reload all item sheets ?',
                content: '<p>Do you really want to reload all sheets at once ?</p>',
                yes: () => {
                    let items = game.items.filter((item) => item.data.data.template === this.item.id);
                    items.forEach((item) => {
                        item.reloadTemplate();
                    });
                },
                no: () => {},
                defaultYes: false
            });
        });

        html.on('dragenter', (event) => {
            html.find('.custom-system-droppable-container').addClass('custom-system-template-dragged-eligible');
        });

        $(document).on('dragend', () => {
            $('.custom-system-template-dragged-eligible').removeClass(
                'custom-system-template-dragged-eligible custom-system-template-dragged-over'
            );
        });
    }
}
