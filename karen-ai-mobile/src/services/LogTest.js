/**
 * Simple log test utility
 */

class LogTest {
  constructor() {
    console.log('LogTest initialized');
    this.logCount = 0;
  }

  test() {
    this.logCount++;
    console.log(`Test log #${this.logCount}`);
    return this.logCount;
  }

  testAlert(Alert) {
    this.logCount++;
    const message = `Test log #${this.logCount}`;
    console.log(message);
    Alert.alert('Log Test', message);
    return this.logCount;
  }
}

export default new LogTest(); 