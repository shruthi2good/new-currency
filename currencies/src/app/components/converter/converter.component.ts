import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatOptionSelectionChange } from '@angular/material/core';
import { MatTableDataSource } from '@angular/material/table';
import { Observable } from 'rxjs';

import { distinctUntilChanged, map, startWith, take } from 'rxjs/operators';
import { ExchangeRatesApiRequestService } from '../../shared/service/exchange-rates-api-request.service';
import { AlertService } from '../../core/alert/alert.service';
import { CurrencyExchangeService, PeriodicHistoryElement } from '../../shared/service/currency-exchange.service';
import {
    ExchangeRatesResponse,
    MappedCurrencyRateObject,
    Statistics,
} from '../../shared/interface/exchange-rates.model';

import { StorageService } from '../../shared/service/storage.service';

import {
    Currency,
    FormNames,
    LocalStorageItems,
    StatisticalDataTableFields,
    TableColumnNames,
    TimeIntervalTypes,
} from '../../shared/interface/enums.model';
import getSymbolFromCurrency from 'currency-symbol-map';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-converter',
    templateUrl: './converter.component.html',
    styleUrls: ['./converter.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class ConverterComponent implements OnInit {
    periodicHistoryData: PeriodicHistoryElement[] = this.currencyExchangeService.periodicHistoryExchangeRates;

    dataSource = new MatTableDataSource(this.periodicHistoryData);
    displayedHistoricalColumns: string[] = [TableColumnNames.Date, TableColumnNames.ExchangeRate];

    statisticalData: Statistics[];
    statisticalDataSource = new MatTableDataSource(this.statisticalData);
    displayedStatisticalColumns: string[] = [TableColumnNames.Name, TableColumnNames.Summary];

    selectedDuration = StorageService.getItem(LocalStorageItems.SelectedTimeInterval) || TimeIntervalTypes.AllTime;

    converterForm: FormGroup;
    filteredFromValues: Observable<string[]>;
    filteredToValues: Observable<string[]>;

    id: number = new Date().getTime();
    amount: number;
    fromRate: number;
    fromCurrency: string;
    toRate: number;
    toCurrency: string;
    result: string;
    mappedCurrencies: string[] = [];

    private readonly FIRST_ITEM = 0;
    private readonly SECOND_ITEM = 1;
    private readonly THIRD_ITEM = 2;

    constructor(
        public currencyExchangeService: CurrencyExchangeService,
        private apiRequestService: ExchangeRatesApiRequestService,
        private alertService: AlertService,
        private translate: TranslateService,
    ) {
        translate.onLangChange.subscribe((event: LangChangeEvent) => {
            // Statistics table column name translations
            this.statisticalData[this.FIRST_ITEM].name = translate.instant('main.tables.lowest');
            this.statisticalData[this.SECOND_ITEM].name = translate.instant('main.tables.highest');
            this.statisticalData[this.THIRD_ITEM].name = translate.instant('main.tables.average');
        });
    }

    ngOnInit() {
        this.converterForm = this.currencyExchangeService.converterForm;

        this.disableInputAreas([FormNames.FromControl, FormNames.ToControl]);

        this.getRates();

        this.filteredFromValues = this.getFromValueChanges(FormNames.FromControl);

        this.filteredToValues = this.getToValueChanges(FormNames.ToControl);

        this.getStatisticalDataValues();

        this.statisticalDataSource = new MatTableDataSource(this.statisticalData);

        this.selectedTimeRange();

        this.converterForm
            .get('amountControl')
            .valueChanges.pipe(distinctUntilChanged())
            .subscribe((amountValue: number) => {
                this.securePositiveInteger('amountControl', amountValue);
            });

        if (this.currencyExchangeService.isServiceReferral) {
            this.currencyExchangeService.toggleServiceReferral();
            this.checkValidityOnLoad(this.converterForm.controls['amountControl'].value, 'amountControl');
            this.checkValidityOnLoad(this.converterForm.controls['toControl'].value, 'toControl');
            this.checkValidityOnLoad(this.converterForm.controls['fromControl'].value, 'fromControl');

            this.setFormValidity();
        }
    }

    securePositiveInteger(formControlName: string, amountValue: number) {
        if (amountValue) {
            if (amountValue < 0) {
                this.converterForm.controls[formControlName].setValue(0);
            }
        }
    }

    selectCurrencyByEnter(event: MatOptionSelectionChange, inputName: string): void {
        if (event.isUserInput) {
            inputName = event.source.value;
        }
    }

    selectCurrencyByClick(selectedOption: string, formControlName: string) {
        this.converterForm.controls[formControlName].setValue(selectedOption);
        this.setFormValidity();
    }

    selectWrittenCurrency(event: any, inputName: string): void {
        const writtenCurrency = event.target.value.toUpperCase();
        this.mappedCurrencies = this.mapItemCurrencies();

        const matchedCurrency =
            this.mappedCurrencies.filter((currency) => currency.includes(writtenCurrency))[this.FIRST_ITEM] ||
            ''.toString();

        if (writtenCurrency.length === 3 && !!matchedCurrency) {
            this.converterForm.controls[inputName].setValue(matchedCurrency);
        }

        this.setFormValidity();
    }

    setFormValidity() {
        const amountControlValue = this.converterForm.controls['amountControl'].value;

        const isAmount = !!amountControlValue;

        this.currencyExchangeService.isValid =
            isAmount && this.checkForMatchedInputValue('fromControl') && this.checkForMatchedInputValue('toControl');
    }

    checkForMatchedInputValue(formControlName: string): boolean {
        const controlValue = this.converterForm.controls[formControlName].value;
        this.mappedCurrencies = this.mapItemCurrencies();

        return this.mappedCurrencies.filter((currency) => currency === controlValue.toUpperCase()).length !== 0;
    }

    checkValidityOnLoad(value: string, inputName: string) {
        const matchedCurrency =
            this.mappedCurrencies.filter((currency) => currency.includes(value))[this.FIRST_ITEM] || ''.toString();

        if (value.length === 3 && !!matchedCurrency) {
            this.converterForm.controls[inputName].setValue(matchedCurrency);
        }
    }

    exchangeRates(): void {
        this.fromRate = this.filterSelectedValue(FormNames.FromControl).rate;
        this.fromCurrency = this.filterSelectedValue(FormNames.FromControl).currency;

        this.toRate = this.filterSelectedValue(FormNames.ToControl).rate;
        this.toCurrency = this.filterSelectedValue(FormNames.ToControl).currency;

        this.amount = Math.floor(this.converterForm.get(FormNames.AmountControl).value);

        this.result = this.calculateExchangeRate();

        this.incrementNumberForID();

        this.currencyExchangeService.periodicHistoryExchangeRates.unshift(this.setPeriodicHistoryElement());

        this.setExchangeRates();

        this.dataSource = new MatTableDataSource(this.periodicHistoryData);

        this.getStatisticalDataValues();

        this.statisticalDataSource = new MatTableDataSource(this.statisticalData);

        this.selectedTimeRange();
    }

    changeExchangeInputValues(): void {
        this.converterForm = new FormGroup({
            amountControl: new FormControl(this.converterForm.get(FormNames.AmountControl).value, [
                Validators.required,
            ]),
            fromControl: new FormControl(this.converterForm.get(FormNames.ToControl).value, [
                Validators.required,
                Validators.minLength(2),
            ]),
            toControl: new FormControl(this.converterForm.get(FormNames.FromControl).value, [
                Validators.required,
                Validators.minLength(2),
            ]),
        });

        this.incrementNumberForID();

        this.currencyExchangeService.fromCurrencies = this.mapItemCurrencies();

        this.currencyExchangeService.toCurrencies = this.mapItemCurrencies();

        this.filteredFromValues = this.getFromValueChanges(FormNames.FromControl);

        this.filteredToValues = this.getToValueChanges(FormNames.ToControl);
    }

    filterSelectedValue(value: string): MappedCurrencyRateObject {
        return this.currencyExchangeService.exchangeRates.filter((item: MappedCurrencyRateObject) => {
            return item.currency === this.converterForm.get(value).value;
        })[this.FIRST_ITEM];
    }

    mapItemCurrencies(): string[] {
        return this.currencyExchangeService.exchangeRates
            .map((currencyItem: MappedCurrencyRateObject) => {
                return currencyItem.currency;
            })
            .sort();
    }

    mapResponseData(responseData: ExchangeRatesResponse): MappedCurrencyRateObject[] {
        return Object.keys(responseData.rates).map(
            (item: string): MappedCurrencyRateObject => {
                return {
                    currency: item,
                    rate: responseData.rates[item],
                };
            },
        );
    }

    getFromValueChanges(stringValue: string): Observable<string[]> {
        return this.converterForm.get(stringValue).valueChanges.pipe(
            startWith(''),
            map((value) => this.filterInputValue(value, this.currencyExchangeService.fromCurrencies)),
        );
    }

    getToValueChanges(stringValue: string): Observable<string[]> {
        return this.converterForm.get(stringValue).valueChanges.pipe(
            startWith(''),
            map((value) => this.filterInputValue(value, this.currencyExchangeService.toCurrencies)),
        );
    }

    getSortedRate(calculationArray: PeriodicHistoryElement[]): number[] {
        return calculationArray
            .map((item: PeriodicHistoryElement) => {
                return Number(item.pureExchangeRate);
            })
            .sort((firstItem, secondItem) => firstItem - secondItem);
    }

    getAverageRate(calculationArray: PeriodicHistoryElement[]): number {
        let values = calculationArray.map((item: PeriodicHistoryElement) => {
            return Number(item.pureExchangeRate);
        });
        let summary = values.reduce((acc, current) => current + acc, 0);

        return Number((summary / values.length).toFixed(5));
    }

    calculateExchangeRate(): string {
        return ((this.converterForm.get(FormNames.AmountControl).value * this.toRate) / this.fromRate).toFixed(3);
    }

    incrementNumberForID(): number {
        return (this.id += 1);
    }

    filterTableUponDaySelection(date: string, dayInterval: number): PeriodicHistoryElement[] {
        return this.currencyExchangeService.periodicHistoryExchangeRates.filter((item) => {
            if (Math.abs(+item.creationDate.split('/')[1] - +date.split('/')[1]) === 1) {
                return Math.abs(+item.creationDate.split('/')[0] - +date.split('/')[0]) >= 30 - dayInterval;
            } else if (Math.abs(+item.creationDate.split('/')[1] - +date.split('/')[1]) === 0) {
                return Math.abs(+(Math.abs(+item.creationDate.split('/')[0] - +date.split('/')[0]) <= dayInterval));
            }
        });
    }

    filterTableUponMonth(date: string, dayInterval: number, monthInterval: number): PeriodicHistoryElement[] {
        return this.currencyExchangeService.periodicHistoryExchangeRates.filter((item) => {
            return (
                Math.abs(+item.creationDate.split('/')[0] - +date.split('/')[0]) <= dayInterval &&
                Math.abs(+item.creationDate.split('/')[1] - +date.split('/')[1]) <= monthInterval
            );
        });
    }

    calculateStatisticsFromNewArray(newDataTableArray: PeriodicHistoryElement[]): void {
        this.statisticalData = [
            {
                name: StatisticalDataTableFields.Lowest,
                summary: this.getSortedRate(newDataTableArray)[this.FIRST_ITEM],
            },
            {
                name: StatisticalDataTableFields.Highest,
                summary: this.getSortedRate(newDataTableArray)[newDataTableArray.length - 1],
            },
            {
                name: StatisticalDataTableFields.Average,
                summary: this.getAverageRate(newDataTableArray) > -1 ? this.getAverageRate(newDataTableArray) : 0,
            },
        ];
    }

    selectedTimeRange(): void {
        const date = this.currencyExchangeService.getCurrentDate('/');

        switch (this.selectedDuration) {
            case TimeIntervalTypes.SevenDays:
                const sevenDaysConversions = this.filterTableUponDaySelection(date, 6);

                this.dataSource = new MatTableDataSource(sevenDaysConversions);

                this.calculateStatisticsFromNewArray(sevenDaysConversions);

                this.statisticalDataSource = new MatTableDataSource(this.statisticalData);

                break;

            case TimeIntervalTypes.FourteenDays:
                const fourteenDaysConversions = this.filterTableUponDaySelection(date, 14);

                this.dataSource = new MatTableDataSource(fourteenDaysConversions);

                this.calculateStatisticsFromNewArray(fourteenDaysConversions);

                this.statisticalDataSource = new MatTableDataSource(this.statisticalData);

                break;

            case TimeIntervalTypes.ThirtyDaysConversions:
                const thirtyDaysConversions = this.filterTableUponMonth(date, 30, 1);

                this.dataSource = new MatTableDataSource(thirtyDaysConversions);

                this.calculateStatisticsFromNewArray(thirtyDaysConversions);

                this.statisticalDataSource = new MatTableDataSource(this.statisticalData);

                break;

            default:
                this.dataSource = new MatTableDataSource(this.periodicHistoryData);

                this.calculateStatisticsFromNewArray(this.currencyExchangeService.periodicHistoryExchangeRates);

                this.statisticalDataSource = new MatTableDataSource(this.statisticalData);

                break;
        }

        StorageService.setItem(LocalStorageItems.SelectedTimeInterval, this.selectedDuration);
    }

    getRates(): void {
        if (!this.currencyExchangeService.exchangeRates) {
            this.apiRequestService.getExchangeRates(Currency.USD).subscribe(
                (exchangeRate: ExchangeRatesResponse): void => {
                    this.currencyExchangeService.exchangeRates = this.mapResponseData(exchangeRate);

                    this.currencyExchangeService.fromCurrencies = this.mapItemCurrencies();

                    this.currencyExchangeService.toCurrencies = this.mapItemCurrencies();

                    this.enableInputAreas([FormNames.FromControl, FormNames.ToControl]);
                },
                (error): void => {
                    this.alertService.error(`Error: ${error.message}`);
                },
            );
        } else {
            this.enableInputAreas([FormNames.FromControl, FormNames.ToControl]);
        }
    }

    setPeriodicHistoryElement(): PeriodicHistoryElement {
        return {
            id: this.id,
            date: `${this.currencyExchangeService.getCurrentDate('/')}
\n@${this.currencyExchangeService.getCurrentTime(':')}`,
            time: this.currencyExchangeService.getCurrentTime(':'),
            exchangeRate: `${this.fromCurrency} → ${this.toCurrency}
\n${(this.toRate / this.fromRate).toFixed(5)}`,
            pureExchangeRate: Number((this.toRate / this.fromRate).toFixed(5)),
            creationDate: this.currencyExchangeService.getCurrentDate('/'),
            fromCurrency: this.fromCurrency,
            toCurrency: this.toCurrency,
            amount: this.amount,
        };
    }

    setExchangeRates(): void {
        return StorageService.setObject(LocalStorageItems.ExchangeRates, [
            ...this.currencyExchangeService.periodicHistoryExchangeRates,
        ]);
    }

    getStatisticalDataValues(): Statistics[] {
        const periodicHistoryArray = this.currencyExchangeService.periodicHistoryExchangeRates;

        return (this.statisticalData = [
            {
                name: StatisticalDataTableFields.Lowest,
                summary: this.getSortedRate(periodicHistoryArray)[this.FIRST_ITEM],
            },
            {
                name: StatisticalDataTableFields.Highest,
                summary: this.getSortedRate(periodicHistoryArray)[periodicHistoryArray.length - 1],
            },
            {
                name: StatisticalDataTableFields.Average,
                summary: this.getAverageRate(periodicHistoryArray) > -1 ? this.getAverageRate(periodicHistoryArray) : 0,
            },
        ]);
    }

    disableInputAreas(inputNames: string[]): void {
        for (let inputName of inputNames) {
            this.converterForm.controls[inputName].disable();
        }
    }

    enableInputAreas(inputNames: string[]): void {
        for (let inputName of inputNames) {
            this.converterForm.controls[inputName].enable();
        }
    }

    getSymbol(rate: string): string {
        return getSymbolFromCurrency(rate);
    }

    private filterInputValue(value: string, arrayGoingFiltered: string[]): string[] {
        const filterValue = value.toLowerCase();

        return arrayGoingFiltered.filter((option) => option.toLowerCase().includes(filterValue));
    }
}
