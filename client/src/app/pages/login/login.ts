import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
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

export class LoginComponent {
  username = '';
  password = '';
  passwordVisible = false;
  isLoading = false;
  wsPort = '';
  toast = inject(ToastService);

  private socketService = inject(SocketService);
  private router = inject(Router);
  private api = inject(ApiService);

  ngOnInit(): void {
    console.clear();

    console.log('%c=== TEST LOGIN DETAILS ===', 'color:#00bcd4;font-size:16px;font-weight:bold;');
    console.log('%cATC', 'color:#4CAF50;font-weight:bold;');
    console.log('Username: amber.blue26');
    console.log('Password: AmberBlu3$');

    console.log('');

    console.log('%cPassenger', 'color:#2196F3;font-weight:bold;');
    console.log('Username: tasha.duncan28');
    console.log('Password: Test123#45');

    console.log('');
    console.log('Enter your WebSocket server port before logging in.');
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
      const response = await this.api.login(this.username, this.password);
      if (response.status === "success" && response.data) {
        const apiKey = response.data.api_key;
        const userType = response.data.type;

        if (!this.wsPort || isNaN(Number(this.wsPort))) {
          this.toast.show('Enter a valid port', 'error');
          return;
        }

        localStorage.setItem("api_key", apiKey);
        localStorage.setItem("user_type", userType);
        localStorage.setItem("ws_port", this.wsPort);

        const userInfo = await this.api.me(apiKey);

        if (userInfo.status === "success" && userInfo.data) {
          localStorage.setItem("user_id", userInfo.data.id.toString());
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
        this.toast.show( response.message ?? 'Login failed', 'error');
        this.isLoading = false;
      }

    } catch (error: any) {
      this.toast.show(error.message || 'Login request failed', 'error');
      this.isLoading = false;
    }
  }

  togglePassword() {
    this.passwordVisible = !this.passwordVisible;
  }
}
