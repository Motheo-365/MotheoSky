import { Injectable, signal } from '@angular/core';

// Represents a toast notification displayed to the user.
export interface ToastMessage {
  id: number,
  text: string,
  type: 'success' | 'error' | 'info';
}


@Injectable({providedIn: 'root'})

/*
  Manages toast notifications across the application.

  This service:
  - Stores all active toast messages
  - Displayes new notifications
  - Automatically removes notifications after a delay
  - Allows notifications to be dismissed manually.
*/
export class ToastService {
  //A reactive list containing all active toast notifications
  toasts = signal<ToastMessage[]>([]);

  /*
    Displays a new toast notification
    Toast is added to the reactive list and automatically removed after 3 seconds.
  */
 show(text: string, type: 'success' | 'error' | 'info' = 'success') {
    const id = Date.now();

    // Asynchronously add new toast to avoid change detection issues.
    Promise.resolve().then(() => {
      this.toasts.update(current => [
        ...current, { id, text, type }
      ]);
    });

    // Automatically dismiss the toast after 3 seconds
    setTimeout(() => this.dismiss(id), 3000);
  }

  // Remove a toast notification from the active list
  dismiss(id: number) {
    // Update reactive list by removing toast
    Promise.resolve().then(() => {
      this.toasts.update(current =>
        current.filter(t => t.id !== id)
      );
    });
  }
}
