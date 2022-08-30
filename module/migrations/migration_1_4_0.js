import { versionCompare } from '../utils.js';

async function processMigration() {
    let actors = game.actors;

    for (let actor of actors) {
        if (versionCompare(actor.getFlag('custom-system-builder', 'version'), '1.4.0') < 0) {
            console.log('Processing migration 1.4.0 for ' + actor.name + ' - ' + actor.id);

            let data = actor.data.data;

            let newContents = [];

            if (data.display.header_below) {
                for (let component of data.header.contents) {
                    newContents.push(component);
                }

                data.header.contents = [];
            }

            if (data.tabs) {
                newContents.push({
                    type: 'tabbedPanel',
                    key: '',
                    cssClass: '',
                    contents: data.tabs
                });

                data.tabs = null;
            }

            data.body.contents = newContents;

            actor.setFlag('custom-system-builder', 'version', '1.4.0');

            await actor.update({
                data: {
                    header: actor.data.data.header,
                    body: actor.data.data.body,
                    '-=tabs': null,
                    display: { '-=header_below': null }
                }
            });

            console.log('\tFinished migration 1.4.0 for ' + actor.name + ' - ' + actor.id);
        }
    }
}

export default { processMigration };
