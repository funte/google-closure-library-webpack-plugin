import { Component } from '@angular/core';

import goog from './lib';

@Component({
  selector: 'root',
  template: `<p>${goog.string.collapseWhitespace('Hello         World!!')}</p>`
})
export class AppComponent { }
