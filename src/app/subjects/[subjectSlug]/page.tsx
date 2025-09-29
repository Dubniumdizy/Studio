import SubjectDetailClient from "./SubjectDetailClient";

export default function SubjectDetailPage({ params }: { params: { subjectSlug: string } }) {
  const subjectSlug = params.subjectSlug;
  return <SubjectDetailClient subjectSlug={subjectSlug} />;
}
