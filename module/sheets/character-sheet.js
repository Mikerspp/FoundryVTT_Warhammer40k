import { CustomActorSheet } from './actor-sheet.js';

/**
 * The character actor sheets
 * @extends {CustomActorSheet}
 * @ignore
 */
export class CharacterSheet extends CustomActorSheet {
    _hasBeenRenderedOnce = false;

    constructor(actor, options) {
        options.resizable = !actor.data.data.display.fix_size;

        super(actor, options);
    }

    render(force, options = {}) {
        if (!this._hasBeenRenderedOnce) {
            this.position.width = this.actor.data.data.display.width;
            this.position.height = this.actor.data.data.display.height;

            this._hasBeenRenderedOnce = true;
        }

        this.options.resizable = !this.actor.data.data.display.fix_size;

        let data = super.render(force, options);

        return data;
    }

    /**
     * @override
     * @ignore
     */
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

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param {Object} actorData The actor to prepare.
     *
     * @return {undefined}
     * @private
     */
    async _prepareSheetData(context) {
        context.availableTemplates = game.actors.filter((actor) => actor.data.type === '_template');

        await super._prepareSheetData(context);
    }

    /**
     * @override
     * @private
     */
    activateListeners(html) {
        super.activateListeners(html);

        // -------------------------------------------------------------
        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        // Template reload button
        html.find('.custom-system-template-select #custom-system-reload-template').click((ev) => {
            if (game.user.isGM) {
                const target = $(ev.currentTarget);
                const templateId = target.parents('.custom-system-template-select').find('#template').val();

                this.actor.reloadTemplate(templateId);
            }
        });
    }
}
