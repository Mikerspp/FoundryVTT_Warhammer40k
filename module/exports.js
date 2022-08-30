/**
 * @ignore
 */
export const exportTemplates = (event) => {
    Dialog.prompt({
        title: 'Select templates',
        content:
            '<h1>Select templates to export :</h1>' +
            '<div class="custom_system_export_divider">' +
            '<div id="custom_system_actor_export_list" class="custom_system_export_list"><h2>Actors :</h2><label><input type="checkbox" checked="checked" class="custom-system-full-selector" />Select / deselect all</label></div>' +
            '<div id="custom_system_item_export_list" class="custom_system_export_list"><h2>Items :</h2><label><input type="checkbox" checked="checked" class="custom-system-full-selector" />Select / deselect all</label></div>' +
            '</div>',
        label: 'Export',
        callback: (html) => {
            // Fetch every _template actor
            let actorTemplates = game.actors.filter((actor) => actor.isTemplate);
            let itemTemplates = game.items.filter((item) => item.isTemplate);

            let tplIds = html
                .find('input:checked')
                .get()
                .filter((elt) => elt.id)
                .map((elt) => {
                    return elt.id;
                });

            // Cleanup data
            let exportActorTemplates = actorTemplates
                .filter((tpl) => {
                    return tplIds.includes(tpl.id);
                })
                .map((tpl) => {
                    tpl = JSON.parse(JSON.stringify(tpl));
                    delete tpl.data.props;

                    return {
                        _id: tpl.id,
                        type: tpl.type,
                        name: tpl.name,
                        data: tpl.data,
                        flags: tpl.flags
                    };
                });

            let exportItemTemplates = itemTemplates
                .filter((tpl) => {
                    return tplIds.includes(tpl.id);
                })
                .map((tpl) => {
                    tpl = JSON.parse(JSON.stringify(tpl));
                    delete tpl.data.props;

                    return {
                        _id: tpl.id,
                        type: tpl.type,
                        name: tpl.name,
                        data: tpl.data,
                        flags: tpl.flags
                    };
                });

            let exportTemplates = {
                isCustomSystemExport: true,
                actors: exportActorTemplates,
                items: exportItemTemplates
            };

            // Download data as JSON
            saveDataToFile(JSON.stringify(exportTemplates), 'text/json', 'export.json');
        },
        render: (html) => {
            console.log(html);
            html.find('#custom_system_actor_export_list').append(
                getFolderStructure(
                    game.folders.filter((folder) => {
                        return folder.depth === 1 && folder.data.type === 'Actor';
                    }),
                    $('<div></div>')
                )
            );
            html.find('#custom_system_item_export_list').append(
                getFolderStructure(
                    game.folders.filter((folder) => {
                        return folder.depth === 1 && folder.data.type === 'Item';
                    }),
                    $('<div></div>')
                )
            );

            html.find('.custom-system-full-selector').on('change', (ev) => {
                let target = $(ev.currentTarget);

                let newState = target.is(':checked');

                target.parents('.custom_system_export_list').find('input[type=checkbox]').prop('checked', newState);
            });
        },
        options: {
            width: 'auto',
            height: 'auto'
        }
    });
};

/**
 * @ignore
 */
const getFolderStructure = (folderArray) => {
    let folderList = $('<div></div>');
    for (let folder of folderArray) {
        let className = '';
        if (folder.depth !== 1) {
            className = 'custom_system_export_folder';
        }

        let baseFolderElt = $(`<div class="${className}"></div>`);
        let expandButton = $(`<i class="fas fa-caret-down"></i>`);
        let checkFolderButton = $(`<input type="checkbox" checked="checked" />`);

        baseFolderElt.append(expandButton);
        baseFolderElt.append(checkFolderButton);
        baseFolderElt.append(folder.name);

        let subFolderStructure = getFolderStructure(folder.children);

        let actorContainer = $(`<div class="custom_system_export_folder"></div>`);
        for (let entity of folder.contents) {
            if (entity.isTemplate) {
                let baseActorElt = $(
                    `<p><input type="checkbox" id="${entity.id}" checked="checked"  data-type="${entity.type}" /><label for="${entity.id}">${entity.name}</label></p>`
                );

                actorContainer.append(baseActorElt);
            }
        }

        subFolderStructure.append(actorContainer);

        expandButton.on('click', () => {
            if (expandButton.hasClass('fa-caret-down')) {
                expandButton.removeClass('fa-caret-down');
                expandButton.addClass('fa-caret-right');

                subFolderStructure.slideUp();
            } else {
                expandButton.removeClass('fa-caret-right');
                expandButton.addClass('fa-caret-down');

                subFolderStructure.slideDown();
            }
        });

        checkFolderButton.on('change', () => {
            subFolderStructure.find('input').prop('checked', checkFolderButton.is(':checked')).trigger('change');
        });

        baseFolderElt.append(subFolderStructure);
        folderList.append(baseFolderElt);
    }

    return folderList;
};

/**
 * @ignore
 */
export const importTemplates = (event) => {
    // Create File Picker to get export JSON
    let fp = new FilePicker({
        callback: async (filePath) => {
            // Get file from server
            const response = await fetch(filePath);
            const importedPack = await response.json();

            // If imported pack is array, trigger only actor import (old format)
            if (Array.isArray(importedPack)) {
                await importActorTemplate(importedPack);
            } else if (importedPack.isCustomSystemExport) {
                await importActorTemplate(importedPack.actors);
                await importItemTemplate(importedPack.items);
            }
        }
    });

    // Tweak to allow only json files to be uploaded / selected
    fp.extensions = ['.json'];
    fp.browse();
};

const importActorTemplate = async (importedPack) => {
    let actorTemplates = game.actors.filter((actor) => actor.isTemplate);

    for (let imported of importedPack) {
        // If a same name template exist, we replace its data with the imported data
        let matchingLocalTemplates = actorTemplates.filter(
            (tpl) => tpl.name === imported.name && tpl.type === imported.type
        );
        if (matchingLocalTemplates.length > 0) {
            for (let match of matchingLocalTemplates) {
                match
                    .update({
                        data: {
                            hidden: imported.data.hidden,
                            header: imported.data.header,
                            tabs: imported.data.tabs,
                            body: imported.data.body
                        },
                        flags: imported.flags
                    })
                    .then(() => {
                        match.render(false);
                    });
            }
        } else {
            // If no same name template exists, we create the template from imported data
            await Actor.create({
                name: imported.name,
                type: imported.type,
                data: imported.data,
                flags: imported.flags
            });
        }
    }
};

const importItemTemplate = async (importedPack) => {
    let itemTemplates = game.items.filter((item) => item.isTemplate);

    for (let imported of importedPack) {
        // If a same name template exist, we replace its data with the imported data
        let matchingLocalTemplates = itemTemplates.filter(
            (tpl) => tpl.name === imported.name && tpl.type === imported.type
        );
        if (matchingLocalTemplates.length > 0) {
            for (let match of matchingLocalTemplates) {
                match
                    .update({
                        data: {
                            hidden: imported.data.hidden,
                            header: imported.data.header,
                            tabs: imported.data.tabs,
                            body: imported.data.body
                        },
                        flags: imported.flags
                    })
                    .then(() => {
                        match.render(false);
                    });
            }
        } else {
            // If no same name template exists, we create the template from imported data
            await Item.create({
                name: imported.name,
                type: imported.type,
                data: imported.data,
                flags: imported.flags
            });
        }
    }
};
