"use strict";
import * as vscode from "vscode";
import { applyProfile, createProfile, deleteProfile, editProfile, exportProfile, importProfile, refreshExtensionList } from "./commands";
import { CommandType } from "./types";
import { checkGlobalProfile, setEnv } from "./utils";

export async function activate(ctx: vscode.ExtensionContext) {
  // Set environments
  setEnv(ctx);

  // Refreshing the list of extensions after startup
  refreshExtensionList({ isCache: true });

  // Registration commands
  ctx.subscriptions.push(
    vscode.commands.registerCommand("vscode-extension-profiles.Refresh" as CommandType, () => refreshExtensionList({})),
    vscode.commands.registerCommand("vscode-extension-profiles.Create" as CommandType, createProfile),
    vscode.commands.registerCommand("vscode-extension-profiles.Apply" as CommandType, applyProfile),
    vscode.commands.registerCommand("vscode-extension-profiles.Edit" as CommandType, editProfile),
    vscode.commands.registerCommand("vscode-extension-profiles.Delete" as CommandType, deleteProfile),
    vscode.commands.registerCommand("vscode-extension-profiles.Export" as CommandType, exportProfile),
    vscode.commands.registerCommand("vscode-extension-profiles.Import" as CommandType, importProfile),
  );

  await checkGlobalProfile();
}

export function deactivate() {}
