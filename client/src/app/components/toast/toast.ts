import { Component, inject } from '@angular/core';
import { ToastService }  from '../../services/toast'

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [],
  templateUrl: './toast.html',
  styleUrl: './toast.css',
})
export class Toast {
  toastService = inject(ToastService);
}
