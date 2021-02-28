/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AsyncDataProvider, IObservableCollection } from 'sql/base/browser/ui/table/asyncDataView';
import { FilterableColumn, IDisposableDataProvider } from 'sql/base/browser/ui/table/interfaces';
import { CellValueGetter, TableDataView, TableFilterFunc, TableSortFunc } from 'sql/base/browser/ui/table/tableDataView';
import { Event, Emitter } from 'vs/base/common/event';
import { DisposableStore } from 'vs/base/common/lifecycle';

export interface HybridDataProviderOptions {
	localDataProcessing: boolean;
	localDataCountLimit?: number;
}

export class HybridDataProvider<T extends Slick.SlickData> implements IDisposableDataProvider<T> {
	private _asyncDataProvider: AsyncDataProvider<T>;
	private _tableDataProvider: TableDataView<T>;
	private _dataCached: boolean = false;
	private _disposableStore = new DisposableStore();

	private _onFilterStateChange = new Emitter<void>();
	get onFilterStateChange(): Event<void> { return this._onFilterStateChange.event; }

	private _onSortComplete = new Emitter<void>();
	get onSortComplete(): Event<void> { return this._onSortComplete.event; }

	constructor(dataRows: IObservableCollection<T>,
		private _loadDataFn: (offset: number, count: number) => Thenable<T[]>,
		filterFn: TableFilterFunc<T>,
		sortFn: TableSortFunc<T>,
		valueGetter: CellValueGetter,
		private readonly _options: HybridDataProviderOptions) {
		this._asyncDataProvider = new AsyncDataProvider<T>(dataRows);
		this._tableDataProvider = new TableDataView<T>(undefined, undefined, sortFn, filterFn, valueGetter);
		this._disposableStore.add(this._asyncDataProvider.onFilterStateChange(() => {
			this._onFilterStateChange.fire();
		}));
		this._disposableStore.add(this._asyncDataProvider.onSortComplete(() => {
			this._onSortComplete.fire();
		}));
		this._disposableStore.add(this._tableDataProvider.onFilterStateChange(() => {
			this._onFilterStateChange.fire();
		}));
		this._disposableStore.add(this._tableDataProvider.onFilterStateChange(() => {
			this._onFilterStateChange.fire();
		}));
	}

	public async getColumnValues(column: Slick.Column<T>): Promise<string[]> {
		if (!this._options.localDataProcessing) {
			return this._asyncDataProvider.getColumnValues(column);
		}
		if (this.thresholdReached) {
			return [];
		}
		if (!this._dataCached) {
			const data = await this._loadDataFn(0, this.length);
			this._dataCached = true;
			this._tableDataProvider.push(data);
		}
		return this._tableDataProvider.getColumnValues(column);
	}

	public async getFilteredColumnValues(column: Slick.Column<T>): Promise<string[]> {
		return this.provider.getFilteredColumnValues(column);
	}

	public get dataRows(): IObservableCollection<T> {
		return this._asyncDataProvider.dataRows;
	}

	public set dataRows(value: IObservableCollection<T>) {
		this._asyncDataProvider.dataRows = value;
	}

	public dispose(): void {
		this._disposableStore.dispose();
		this._asyncDataProvider.dispose();
		this._tableDataProvider.dispose();
	}

	public getLength(): number {
		return this.provider.getLength();
	}

	public getItem(index: number): T {
		return this.provider.getItem(index);
	}

	public getItems(): T[] {
		throw new Error('Method should not be called.');
	}

	public get length(): number {
		return this.provider.getLength();
	}

	public set length(value: number) {
		this._asyncDataProvider.length = value;
	}

	public async filter(columns: FilterableColumn<T>[]) {
		this.provider.filter(columns);
	}

	public async sort(options: Slick.OnSortEventArgs<T>) {
		this.provider.sort(options);
	}

	private get thresholdReached(): boolean {
		return this._options.localDataCountLimit !== undefined && this.length > this._options.localDataCountLimit;
	}

	private get provider(): IDisposableDataProvider<T> {
		return this._dataCached ? this._tableDataProvider : this._asyncDataProvider;
	}
}
