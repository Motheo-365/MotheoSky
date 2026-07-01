import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number,
  text: string,
  type: 'success' | 'error' | 'info';
}


@Injectable({providedIn: 'root'})

export class ToastService {
  //A reactive list array tracking active toatss
  toasts = signal<ToastMessage[]>([]);

 show(text: string, type: 'success' | 'error' | 'info' = 'success') {
    const id = Date.now();

    Promise.resolve().then(() => {
      this.toasts.update(current => [
        ...current, { id, text, type }
      ]);
    });

    // Automatically dismiss the toast after 3 seconds
    setTimeout(() => this.dismiss(id), 3000);
  }

  dismiss(id: number) {
    Promise.resolve().then(() => {
      this.toasts.update(current =>
        current.filter(t => t.id !== id)
      );
    });
  }
}
