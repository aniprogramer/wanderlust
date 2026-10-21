// Fixed ids so the spec can address seeded records directly.
const day = (offset) =>
  new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

module.exports = {
  PORT: 3100,
  PASSWORD: "password123",
  ids: {
    alice: "64b000000000000000000001",
    bob: "64b000000000000000000002",
    pinned: "64b0000000000000000000a1",
    bookingSoon: "64b0000000000000000000b1",
    bookingLater: "64b0000000000000000000b2",
  },
  booked: [day(3), day(4)], // nights of bookingSoon
  freeRange: [day(7), day(9)],
  day,
};
