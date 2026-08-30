import { runCirculationMaintenance } from "../api/src/services/reservations";

runCirculationMaintenance()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
