import TripReview from "../../subpages/trip-review";
export default async function ReviewPage({ params }: { params: Promise<{ tripId: string }> }) { const { tripId } = await params; return <TripReview tripId={tripId} />; }
