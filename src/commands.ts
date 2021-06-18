/* eslint-disable @typescript-eslint/naming-convention */

import * as vscode from "vscode";
import { getAllExtensions, setGlobalStorageValue, setWorkspaceStorageValue } from "./storage";
import { ExtensionList, ExtensionValue } from "./types";
import { getExtensionList, getProfileList, getUserWorkspaceStorageUUID, getWorkspacesUUID } from "./utils";
export const CommandTypes = [
  "vscode-extension-profiles.Refresh",
  "vscode-extension-profiles.Create",
  "vscode-extension-profiles.Edite",
  "vscode-extension-profiles.Apply",
  "vscode-extension-profiles.Delete",
] as const;

type Args = { ctx: vscode.ExtensionContext, isCache?: boolean};

export const Commands: Record<typeof CommandTypes[number], (args: Args) => any> = {
  "vscode-extension-profiles.Refresh": refreshExtensionList,
  "vscode-extension-profiles.Create": createProfile,
  "vscode-extension-profiles.Edite": editeProfile,
  "vscode-extension-profiles.Apply": applyProfile,
  "vscode-extension-profiles.Delete": deleteProfile,
};

// Select and apply profile ...
async function applyProfile() {

  // Checking whether the workspace is open
  let folders = vscode.workspace.workspaceFolders;
  if (folders === undefined) {
    return vscode.window.showErrorMessage("Working folder not found, open a folder an try again.");
  }

  // Get and check profiles
  const profiles = await getProfileList();
  if (Object.keys(profiles).length === 0) {
    return vscode.window.showErrorMessage("No profiles found, please create a profile first.");
  }

  // Generate items
  let itemsProfiles: vscode.QuickPickItem[] = [];
  for (const item in profiles) {
    itemsProfiles.push({
      label: item,
    });
  }

  // Selected profile
  let profileName = (await vscode.window.showQuickPick(itemsProfiles, { placeHolder: "Search" , title:"Select a profile"}))?.label;
  if (!profileName) {
    return;
  }

  // Check and refresh extension list
  let extensions = await getExtensionList();
  if (Object.keys(extensions).length === 0) {
    extensions = await refreshExtensionList({ isCache: true });
  }

  let enabledList: ExtensionValue[] = [];
  let disabledList: ExtensionValue[] = [];

  for (const key in extensions) {
    let item: ExtensionValue = { id: key, uuid: extensions[key].uuid };

    // Set enabled and disabled extensions for workspace
    if (profiles[profileName][key] !== undefined) {
      enabledList.push(item);
    } else {
      disabledList.push(item);
    }
  }

  let fsPath = folders[0].uri.fsPath;
  let uuid = "";
  if (folders.length > 1) {
    let uriFolders: vscode.Uri[] = [];
    for (const folder of folders) {
      uriFolders.push(folder.uri);
    }
    uuid = await getWorkspacesUUID(uriFolders);
  } else {
    uuid = await getUserWorkspaceStorageUUID(vscode.Uri.parse(fsPath));
  }

  // write in workspace
  await setWorkspaceStorageValue(uuid, "enabled", enabledList);
  await setWorkspaceStorageValue(uuid, "disabled", disabledList);

  // Reloading the window to apply extensions
  return vscode.commands.executeCommand("workbench.action.reloadWindow");
}

// Create profile ...
export async function createProfile() {
  const profiles = await getProfileList();

  // set name profile
  let profileName;
  let placeHolder = "Come up with a profile name";
  while (true) {
    profileName = await vscode.window.showInputBox({ placeHolder, title: "Create new profile" });

    if (profileName && Object.keys(profiles).includes(profileName)) {
      placeHolder = `The profile \"${profileName}\" already exists, think of another name`;
      continue; //go next step
    } else if (!profileName) {
      return; // close input box
    }

    break;
  }

  // Get extension list of cache
  let extensions = await getExtensionList();

  // update if not exist
  if (Object.keys(extensions).length === 0) {
    extensions = await refreshExtensionList({ isCache: true });
  }

  // create extension list
  let itemsWorkspace: vscode.QuickPickItem[] = [];
  for (const key in extensions) {
    let item = extensions[key];
    itemsWorkspace.push({
      label: item.label || key,
      description: item.label ? key : undefined,
      detail: item.description || " - - - - - ",
    });
  }

  // show and select extensions
  let selected = await vscode.window.showQuickPick(itemsWorkspace, {
    canPickMany: true,
    placeHolder: "The selected extensions will be enabled for the workspace",
    title: `Select extensions for "${profileName}"`,
  });

  // set enabled extensions for profile
  profiles[profileName] = {};

  if (selected) {
    for (const { description: key } of selected) {
      profiles[profileName][key!] = extensions[key!];
    }
  }

  await setGlobalStorageValue("vscodeExtensionProfiles/profiles", profiles);

  return vscode.window.showInformationMessage(`Profile "${profileName}" successfully created!`);
}

// Edite profile ...
async function editeProfile() {
  // Get and check profiles
  const profiles = await getProfileList();
  if (Object.keys(profiles).length === 0) {
    createProfile();
    return vscode.window.showErrorMessage("No profiles found, please create a profile first.");
  }

  // Generate items
  let itemsProfiles: vscode.QuickPickItem[] = [];
  for (const item in profiles) {
    itemsProfiles.push({
      label: item,
    });
  }

  // Selected profile
  let profileName = (await vscode.window.showQuickPick(itemsProfiles, { placeHolder: "Search" , title:"Select a profile to edit"}))?.label;
  if (!profileName) {
    return;
  }

  // Check and refresh extension list
  let extensions = await getExtensionList();
  if (Object.keys(extensions).length === 0) {
    extensions = await refreshExtensionList({ isCache: true });
  }

  // add exists (maybe disabled extension)
  for (const key in profiles[profileName]) {
    extensions[key] = profiles[profileName][key];
  }

  // create extension list
  let itemsWorkspace: vscode.QuickPickItem[] = [];
  for (const key in extensions) {
    let item = extensions[key];
    itemsWorkspace.push({
      label: item.label || key,
      description: item.label ? key : undefined,
      detail: item.description || " - - - - - ",
      picked: profiles[profileName][key] !== undefined
    });
  }


  // show and select extensions
  let selected = await vscode.window.showQuickPick(itemsWorkspace, {
    canPickMany: true,
    placeHolder: "The selected extensions will be enabled for the workspace",
    title: `Select extensions for "${profileName}"`,
  });


  // set enabled extensions for profile
  profiles[profileName] = {};

  if (selected) {
    for (const { description: key } of selected) {
      profiles[profileName][key!] = extensions[key!];
    }
  } else {
    return;
  }

  await setGlobalStorageValue("vscodeExtensionProfiles/profiles", profiles);
  return vscode.window.showInformationMessage(`Profile "${profileName}" successfully updated!`);
}

// Delete profile ...
async function deleteProfile() {
  // Get all profiles
  const profiles = await getProfileList();
  if (Object.keys(profiles).length === 0) {
    return vscode.window.showInformationMessage("All right, no profiles to delete! 😌");
  }


  // Generate items
  let itemsProfiles: vscode.QuickPickItem[] = [];
  for (const item in profiles) {
    itemsProfiles.push({
      label: item,
    });
  }

  // Selected profile
  let profileName = (await vscode.window.showQuickPick(itemsProfiles, { placeHolder: "Search" , title:"Select a profile to edit"}))?.label;
  if (!profileName) {
    return;
  }

  delete profiles[profileName];

  await setGlobalStorageValue("vscodeExtensionProfiles/profiles", profiles);
  return vscode.window.showInformationMessage(`Profile "${profileName}" successfully deleted!`);
}

export async function refreshExtensionList({ isCache = false }) {
  let oldExtensionList = await getExtensionList();
  let newExtensionList: ExtensionList = {};

  for (const item of await getAllExtensions()) {
    if (!item.label || !item.description) {
      item.label = item.id;
      if (Object.keys(oldExtensionList).length > 0) {
        for (const key in oldExtensionList) {
          if (item.id === key) {
            if (item.label === key) {
              if (oldExtensionList[key].label) {
                item.label = oldExtensionList[key].label;
              }
            }
            if (oldExtensionList[key].description) {
              item.description = oldExtensionList[key].description;
            }
            break;
          }
        }
      }
    }

    newExtensionList[item.id] = {
      uuid: item.uuid,
      label: item.label,
      description: item.description,
    };
  }

  //
  if (isCache) {
    // Add missing items from the cache
    for (const key in oldExtensionList) {
      let item = newExtensionList[key];
      if (item === undefined) {
        newExtensionList[key] = {
          uuid: oldExtensionList[key].uuid,
          label: oldExtensionList[key].label,
          description: oldExtensionList[key].description,
        };
      }
    }
  }

  await setGlobalStorageValue("vscodeExtensionProfiles/extensions", newExtensionList);

  vscode.window.showInformationMessage("Updated the list of installed extensions!");
  return newExtensionList;
}