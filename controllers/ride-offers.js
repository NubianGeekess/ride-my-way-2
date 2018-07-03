import client from '../models/db';

const uuid = require('uuid');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getAllRides = (req, res) => {
  const { destination, startingPoint } = req.query;

  if (destination && startingPoint) {
    client
      .query('SELECT * from ride_offers WHERE destination = $1 AND point_of_departure = $2', [destination, startingPoint])
      .then((rides) => {
        res.status(200).send({
          status: 'success',
          data: rides.rows,
          message: `${rides.rowCount} Rides round`,
        });
      })
      .catch(() => {
        res.status(500).send({
          status: 'error',
          message: 'An error occurred fetching ride offers.',
        });
      });
  }
  client
    .query('SELECT * from ride_offers')
    .then((rides) => {
      res.status(200).send({
        status: 'success',
        data: rides.rows,
        message: `${rides.rowCount} Ride(s) found`,
      });
    })
    .catch(() => {
      res.status(500).send({
        status: 'error',
        message: 'An error occurred fetching ride offers.',
      });
    });
};

const getOneRide = (req, res) => {
  const { rideId } = req.params;

  if (!uuidRegex.test(rideId)) {
    return res.status(400).send({
      status: 'error',
      message: 'ID supplied is invalid',
    });
  }

  client
    .query('SELECT * from ride_offers WHERE id = $1', [rideId])
    .then((ride) => {
      if (ride.rowCount === 0) {
        return res.status(404).send({
          status: 'error',
          message: 'Ride offer with that id does not exist.',
        });
      }
      res.status(200).send({
        status: 'success',
        data: ride.rows[0],
        message: 'Specified ride offer found.',
      });
    })
    .catch(() => {
      res.status(500).send({
        status: 'error',
        message: 'An error occurred fetching details of ride offer.',
      });
    });
};

const createRideOffer = (req, res) => {
  const {
    destination,
    departureTime,
    pointOfDeparture,
    vehicleCapacity,
    departureDate,
  } = req.body;

  if (
    !vehicleCapacity ||
    !destination ||
    !departureTime ||
    !pointOfDeparture ||
    !departureDate
  ) {
    return res.status(400).send({
      status: 'failed',
      message: 'A Required field is missing.',
    });
  }

  client
    .query(
      'INSERT INTO ride_offers(id, user_id, destination, point_of_departure, vehicle_capacity, departure_time, departure_date) values($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [
        uuid(),
        req.userId,
        destination,
        pointOfDeparture,
        vehicleCapacity,
        departureTime,
        departureDate,
      ],
    )
    .then((resp) => {
      res.status(201).send({
        status: 'success',
        data: resp.rows[0],
        message: 'Ride offer successfully created.',
      });
    })
    .catch(() => {
      res
        .status(500)
        .send({ status: 'error', message: 'An error occurred when creating ride offer.' });
    });
};

const joinRide = (req, res) => {
  const { rideId } = req.params;

  if (!uuidRegex.test(rideId)) {
    return res.status(400).send({
      status: 'failed',
      message: 'ID supplied is invalid',
    });
  }

  client
    .query('SELECT * FROM ride_offers WHERE id = $1', [rideId])
    .then((ride) => {
      if (ride.rowCount === 0) {
        return res.status(404).send({
          status: 'failed',
          message: 'A ride with that ID does not exist',
        });
      }
      client
        .query(
          'INSERT INTO requests(id, ride_id, user_id) values($1, $2, $3) RETURNING *',
          [uuid(), rideId, req.userId],
        )
        .then((data) => {
          res.status(201).send({
            status: 'success',
            data: data.rows[0],
            message: 'Joined ride successfully',
          });
        })
        .catch(() => {
          res.status(500).send({
            status: 'error',
            message: 'An error occurred when trying to make a request to a ride offer.',
          });
        });
    })
    .catch(() => {
      res
        .status(500)
        .send({ status: 'error', message: 'An unexpected error occured.' });
    });
};

const getOfferRequests = (req, res) => {
  const { rideId } = req.params;

  if (!uuidRegex.test(rideId)) {
    return res.status(400).send({
      status: 'failed',
      message: 'ID supplied is invalid',
    });
  }

  client
    .query('SELECT * from requests where ride_id = $1', [rideId])
    .then((request) => {
      res.status(200).send({
        status: 'success',
        data: request.rows,
        message: `${request.rowCount} offer requests found`,
      });
    })
    .catch(() => {
      res.status(500).send({
        status: 'error',
        message: 'An error occurred fetching requests.',
      });
    });
};

const respondToRideRequest = (req, res) => {
  const { status } = req.body;
  const { rideId, requestId } = req.params;

  const validStatus = ['accepted', 'rejected'];

  if (!validStatus.includes(status.toLowerCase())) {
    return res.status(400).send({
      status: 'failed',
      message: 'status field supplied is invalid. Please supply "acepted" or "rejected"',
    });
  }

  if (!uuidRegex.test(rideId) || !uuidRegex.test(requestId)) {
    return res.status(400).send({
      status: 'failed',
      message: 'ID supplied is invalid',
    });
  }

  client
    .query('SELECT * from requests where ride_id = $1 AND id = $2', [rideId, requestId])
    .then((request) => {
      if (request.rowCount === 0) {
        res.status(404).send({
          status: 'failed',
          message: 'The specified request does not exist.',
        });
      } else if (request.rows[0].user_id === req.userId) {
        client
          .query(
            'UPDATE requests SET status = $1 WHERE id = $2 RETURNING *',
            [status, requestId],
          )
          .then((data) => {
            res.status(200).send({
              status: 'success',
              data: data.rows[0],
              message: 'Successfully responded to ride offer request.'
            });
          })
          .catch(() => {
            res.status(500).send({
              status: 'error',
              message: 'An error occured when responding to ride offer request.',
            });
          });
      } else {
        res.status(400).send({
          status: 'error',
          message: 'You are not permitted to respond to this request.',
        });
      }
    })
    .catch(() => {
      res.status(500).send({
        status: 'error',
        message: 'An unexpected error occurred.',
      });
    });
};

export {
  getAllRides,
  getOneRide,
  createRideOffer,
  joinRide,
  getOfferRequests,
  respondToRideRequest,
};