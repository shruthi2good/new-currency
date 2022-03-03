export interface StringNumberPair {
    [key: string]: number;
}

export interface ExchangeRatesResponse {
    base: string;
    rates: StringNumberPair;
}

export interface MappedCurrencyRateObject {
    currency: string;
    rate: number;
}

export interface Statistics {
    name: string;
    summary: number;
}
