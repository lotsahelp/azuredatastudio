/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceInfo } from 'arc';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ControllerModel, Registration } from './controllerModel';
import { createCredentialId } from '../common/utils';
import { credentialNamespace } from '../constants';

export abstract class ResourceModel {

	private readonly _onRegistrationUpdated = new vscode.EventEmitter<Registration>();
	public onRegistrationUpdated = this._onRegistrationUpdated.event;

	constructor(protected _controllerModel: ControllerModel, public info: ResourceInfo, private _registration: Registration) { }

	public get registration(): Registration {
		return this._registration;
	}

	public set registration(newValue: Registration) {
		this._registration = newValue;
		this._onRegistrationUpdated.fire(this._registration);
	}

	/**
 * Loads the saved connection profile associated with this model. Will prompt for one if
 * we don't have one or can't find it (it was deleted)
 */
	protected async getConnectionProfile(): Promise<void> {
		let connectionProfile: azdata.IConnectionProfile | undefined = this.createConnectionProfile();

		// If we have the ID stored then try to retrieve the password from previous connections
		if (this.info.connectionId) {
			try {
				const credentialProvider = await azdata.credentials.getProvider(credentialNamespace);
				const credentials = await credentialProvider.readCredential(createCredentialId(this._controllerModel.info.id, this.info.resourceType, this.info.name));
				if (credentials.password) {
					// Try to connect to verify credentials are still valid
					connectionProfile.password = credentials.password;
					// If we don't have a username for some reason then just continue on and we'll prompt for the username below
					if (connectionProfile.userName) {
						const result = await azdata.connection.connect(connectionProfile, false, false);
						if (!result.connected) {
							//vscode.window.showErrorMessage(loc.connectToPGSqlFailed(connectionProfile.serverName, result.errorMessage));
							await this.promptForConnection(connectionProfile);
						}
					}
				}
			} catch (err) {
				console.warn(`Unexpected error fetching password for Postgres instance ${err}`);
				// ignore - something happened fetching the password so just reprompt
			}
		}

		if (!connectionProfile?.userName || !connectionProfile?.password) {
			// Need to prompt user for password since we don't have one stored
			await this.promptForConnection(connectionProfile);
		}
	}

	public abstract refresh(): Promise<void>;

	protected abstract createConnectionProfile(): azdata.IConnectionProfile;

	protected abstract promptForConnection(connectionProfile: azdata.IConnectionProfile): Promise<void>;
}
