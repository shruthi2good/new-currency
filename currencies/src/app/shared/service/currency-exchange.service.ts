import { Injectable, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { MappedCurrencyRateObject } from '../interface/exchange-rates.model';
import { StorageService } from './storage.service';

export interface PeriodicHistoryElement {
    id: number;
    date: string;
    time: string;
    exchangeRate: string;
    pureExchangeRate?: number;
    creationDate?: string;
    fromCurrency?: string;
    toCurrency?: string;
    amount?: number;
}

@Injectable()
export class CurrencyExchangeService implements OnInit {
    converterForm: FormGroup = new FormGroup({
        amountControl: new FormControl('', [Validators.required]),
        fromControl: new FormControl('', [Validators.required, Validators.minLength(2)]),
        toControl: new FormControl('', [Validators.required, Validators.minLength(2)]),
    });

    exchangeRates: MappedCurrencyRateObject[];
    periodicHistoryExchangeRates: PeriodicHistoryElement[] =
        <PeriodicHistoryElement[]>StorageService.getObject('exchangeRates') || [];

    fromCurrencies: string[] = [];
    toCurrencies: string[] = [];

    currentDate: string;
    currentTime: string;
    isValid = false;
    isServiceReferral = false;

    static toTwoDigits(givenNumber: number) {
        return givenNumber > 9 ? `${givenNumber}` : `0${givenNumber}`;
    }

    constructor() {}

    ngOnInit() {}

    getCurrentDate(separator: string): string {
        const now = new Date();

        const currentDay = now.getDate();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        this.currentDate = [currentDay, currentMonth, currentYear]
            .map(CurrencyExchangeService.toTwoDigits)
            .join(separator);

        return this.currentDate;
    }

    getCurrentTime(separator: string): string {
        const now = new Date();

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSecond = now.getSeconds();

        this.currentTime = [currentHour, currentMinute, currentSecond]
            .map(CurrencyExchangeService.toTwoDigits)
            .join(separator);

        return this.currentTime;
    }

    toggleServiceReferral() {
        return (this.isServiceReferral = !this.isServiceReferral);
    }
}
