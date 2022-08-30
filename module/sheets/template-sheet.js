import { CustomActorSheet } from './actor-sheet.js';
import templateFunctions from './template-functions.js';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {CustomActorSheet}
 * @ignore
 */
export class TemplateSheet extends CustomActorSheet {
    /* -------------------------------------------- */

    /** @override */
    async getData() {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = super.getData();

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
                this.actor
                    .update({
                        data: {
                            hidden: newAttributes
                        }
                    })
                    .then(() => {
                        this.render(false);
                    });
            }, this.actor.data.data.hidden);
        });

        // Edit attribute bars
        html.find('.custom-system-configure-attribute-bars').click((ev) => {
            // Open the dialog for edition
            templateFunctions.attributeBars((newAttributeBars) => {
                // This is called on dialog validation

                for (let barName in this.actor.data.data.attributeBar) {
                    if (!newAttributeBars[barName]) {
                        newAttributeBars['-=' + barName] = null;
                    }
                }

                // Update the actor with new hidden attributes
                this.actor
                    .update({
                        data: {
                            attributeBar: newAttributeBars
                        }
                    })
                    .then(() => {
                        this.render(false);
                    });
            }, this.actor.data.data.attributeBar);
        });

        // Edit display settings
        html.find('.custom-system-configure-display').click((ev) => {
            // Open the dialog for edition
            templateFunctions.displaySettings((displaySettings) => {
                // This is called on dialog validation

                // Update the actor with new hidden attributes
                this.actor
                    .update({
                        data: {
                            display: displaySettings
                        }
                    })
                    .then(() => {
                        this.render(false);
                    });
            }, this.actor.data.data.display);
        });

        // Edit active effects actions
        html.find('.custom-system-configure-active-effects').click((ev) => {
            let allEffects = CONFIG.statusEffects.map((anEffect) => {
                anEffect.modifiers = this.actor.data.data.activeEffects[anEffect.id] ?? [];
                anEffect.label = game.i18n.localize(anEffect.label);

                return anEffect;
            });

            // Open the dialog for edition
            templateFunctions.modifiers((activeEffects) => {
                // This is called on dialog validation

                // Update the actor with new active effects modifiers
                this.actor
                    .update({
                        data: {
                            activeEffects: activeEffects
                        }
                    })
                    .then(() => {
                        this.render(false);
                    });
            }, allEffects);
        });

        // Reload all sheets
        html.find('.custom-system-reload-all-sheets').click((ev) => {
            Dialog.confirm({
                title: 'Reload all character sheets ?',
                content: '<p>Do you really want to reload all sheets at once ?</p>',
                yes: () => {
                    let actors = game.actors.filter((actor) => actor.data.data.template === this.actor.id);
                    actors.forEach((actor) => {
                        actor.reloadTemplate();
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
