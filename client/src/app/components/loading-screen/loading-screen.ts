import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-screen',
  standalone: true,
  templateUrl: './loading-screen.html',
  styleUrl: './loading-screen.css',
})
export class LoadingScreen {
  // Let the login page drive the visibility state bound to this.isLoading
  @Input() set visible(show: boolean) {
    if (!show) {
      this.hide();
    } else {
      this.isVisible = true;
      this.isRendered = true;
    }
  }

  isVisible = false;
  isRendered = false;

  private hide() {
    this.isVisible = false;
    setTimeout(() => {
      this.isRendered = false;
    }, 600); // Wait for CSS fade animation
  }
}
