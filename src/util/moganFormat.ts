import morgan from "morgan";
import chalk from "chalk"; 

export const customMorganFormat = (tokens: any, req: any, res: any) => {
    const status = tokens.status(req, res);
    const method = tokens.method(req, res);
    const url = tokens.url(req, res);
    const responseTime = tokens['response-time'](req, res);
    
    // Definiere Farben basierend auf dem HTTP-Statuscode
    let statusColor;
    if (status >= 500) {
      statusColor = chalk.red(status);
    } else if (status >= 400) {
      statusColor = chalk.yellow(status); 
    } else if(status === 403) {
      statusColor = chalk.magenta(status);
    } else if (status === "200") {
      statusColor = chalk.green(status); 
    } else if(status === "201") {
      statusColor = chalk.greenBright(status); 
    }
    
    
    else {
      statusColor = chalk.cyan(status); // Andere Statuscodes cyan
    }
    
    // Formatiere die Log-Nachricht
    return [
      chalk.blue(method), // Farbe für HTTP-Methode
      chalk.magenta(url), // Farbe für URL
      statusColor,  // Statuscode mit Farbe
      `${responseTime} ms`, // Antwortzeit
    ].join(" - ");
  };