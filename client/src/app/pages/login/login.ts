import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { login, me } from '../../services/api';
import { SocketService } from '../../services/server';
import { ToastService } from '../../services/toast';
import { Router } from '@angular/router'
import { LoadingScreen } from '../../components/loading-screen/loading-screen';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, LoadingScreen],
  templateUrl: './login.html',
  styleUrl: './login.css',
})

export class Login {
  username = '';
  password = '';
  passwordVisible = false;
  isLoading = false;
  wsPort = '';
  toast = inject(ToastService);

  private socketService = inject(SocketService);
  private router = inject(Router);


  private toastTextFromResponse(response: any, fallback: string) {
    if (typeof response?.data === 'string') {
      return response.data;
    }

    if (response?.data?.message) {
      return response.data.message;
    }

    return response?.message ?? fallback;
  }


  async onLogin() {
    if (!this.username || !this.password) {
      this.toast.show('Enter username and password', 'error');
      return;
    }

    //Validate port FIRST before hitting the server
    if (!this.wsPort || isNaN(Number(this.wsPort))) {
      this.toast.show('Enter a valid port', 'error');
      return;
    }
    this.isLoading = true;

    try {
      const response = await login(this.username, this.password);
      if (response.status === "success") {
        const apiKey = response.data.api_key;
        const userType = response.data.type;

        if (!this.wsPort || isNaN(Number(this.wsPort))) {
          this.toast.show('Enter a valid port', 'error');
          return;
        }

        localStorage.setItem("api_key", apiKey);
        localStorage.setItem("user_type", userType);
        localStorage.setItem("ws_port", this.wsPort);

        const userInfo = await me(apiKey);

        if (userInfo.status === "success") {
          localStorage.setItem("user_id", userInfo.data.id);
          localStorage.setItem("username", userInfo.data.username);
        }

        this.socketService.connect(
          apiKey,
          Number(this.wsPort),
          response.data.username
        );

        const targetDashboard = userType.toLowerCase() === 'atc' ? '/atc' : '/passenger';
        await this.router.navigate([targetDashboard]);
      }
      else {
        this.toast.show(this.toastTextFromResponse(response, 'Login failed'), 'error');
        this.isLoading = false;
      }

    } catch (error: any) {
      this.toast.show(error?.message || 'Login request failed', 'error');
      this.isLoading = false;
    }
  }

  togglePassword() {
    this.passwordVisible = !this.passwordVisible;
  }
}
