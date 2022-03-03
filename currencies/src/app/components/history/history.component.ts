import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';

import { CurrencyExchangeService, PeriodicHistoryElement } from '../../shared/service/currency-exchange.service';
import { StorageService } from '../../shared/service/storage.service';



import * as Chart from 'chart.js';
import {ChartOptions} from 'chart.js';
import { Label } from 'ng2-charts';



export interface HistoryElement {
    id: number;
    date: string;
    event: string;
    actions: string;
    amount?: number;
    fromCurrency?: string;
    toCurrency?: string;
}

@Component({
    selector: 'app-history',
    templateUrl: './history.component.html',
    styleUrls: ['./history.component.scss'],
})
export class HistoryComponent implements OnInit {
    periodicHistoryData: HistoryElement[];
    displayedHistoricalColumns: string[] = ['date', 'event', 'actions'];
    periodicHistoryDataSource: MatTableDataSource<HistoryElement>;
    canvas: any;
    ctx: any;
    historydate: { x: HistoryElement["date"]; y: HistoryElement["event"]; }[];
    currentDate=new Date();
    
    
    

    constructor(private currencyExchangeService: CurrencyExchangeService, private router: Router) {}

    ngOnInit() {
        this.periodicHistoryData = this.customHistoryData() || [];
        this.periodicHistoryDataSource = new MatTableDataSource(this.periodicHistoryData);
    }

    ngAfterViewInit() {
        //const Chart = require("Chart");
        console.log('the data is ',this.periodicHistoryData),
        this.canvas = document.getElementById('myChart');
        this.ctx = this.canvas.getContext('2d');
        this.historydate= this.periodicHistoryData.map(a => { return { x: a.date, y: a.event  } });
        

        var x = new Chart(this.ctx, {
          type: 'scatter',
          //history:HistoryElement,
          
          data: {
              labels: ["date"],
              datasets: [{
                  label: 'id',
                  data: this.historydate,
                 // data: [this.periodicHistoryData.id, this.periodicHistoryData.event],
                 borderColor: 'rgb(0, 128, 0)',
                  borderWidth: 1
              }]
          },
          options: {
            responsive: true,
            scales: {
                yAxes: [{
                   // beginAtZero: true,
                    
                    gridLines: {
                        display: true,
                        drawTicks: false,
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'events'
                      },
                    ticks: {
                        stepSize: 0.1
                    }
                }],
                xAxes: [{
                    // beginAtZero: true,
                     
                     gridLines: {
                         display: true,
                         drawTicks: true,
                     },
                     scaleLabel: {
                         display: true,
                         labelString: 'date'
                       },
                     ticks: {
                         stepSize: 0.1
                     }
                 }]
               
            }
         }
          
        });
      }

    customHistoryData() {
        return this.currencyExchangeService.periodicHistoryExchangeRates.map(
            (item: PeriodicHistoryElement): HistoryElement => {
                return {
                    id: item.id,
                    date: item.date,
                    event: `Converted an amount of ${item.amount} from ${item.fromCurrency} to ${item.toCurrency}`,
                    actions: '',
                    amount: item.amount,
                    fromCurrency: item.fromCurrency,
                    toCurrency: item.toCurrency,
                };
            },
        );
    }

    setCurrencyJob(amount: string, fromCurrency: string, toCurrency: string) {
        this.router.navigate(['converter']).then();

        this.currencyExchangeService.toggleServiceReferral();

        this.currencyExchangeService.converterForm = new FormGroup({
            amountControl: new FormControl(amount, [Validators.required]),
            fromControl: new FormControl(fromCurrency, [Validators.required]),
            toControl: new FormControl(toCurrency, [Validators.required]),
        });
    }

    removeCurrencyItem(element: PeriodicHistoryElement) {
        this.currencyExchangeService.periodicHistoryExchangeRates = this.filterHistoryList(element);

        this.setFilteredDataToStorage();

        this.periodicHistoryDataSource = new MatTableDataSource(this.customHistoryData());
    }

    filterHistoryList(item: PeriodicHistoryElement): PeriodicHistoryElement[] {
        return this.currencyExchangeService.periodicHistoryExchangeRates.filter(
            (matchedItem) => matchedItem.id !== item.id,
        );
    }

    setFilteredDataToStorage() {
        StorageService.setObject('exchangeRates', [...this.currencyExchangeService.periodicHistoryExchangeRates]);
    }
}
