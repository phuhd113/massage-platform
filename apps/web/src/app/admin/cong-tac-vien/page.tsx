import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CollaboratorManager } from '@/components/CollaboratorManager';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import type { AdminCollaborator } from '@/lib/types';

export const metadata: Metadata = { title: 'Cộng tác viên' };

type CollaboratorList = { items: AdminCollaborator[]; total: number };

export default async function CollaboratorsPage() {
  let list: CollaboratorList;

  try {
    list = await authFetch<CollaboratorList>('/collaborators?limit=100');
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap?next=/admin/cong-tac-vien');
    throw err;
  }

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Cộng tác viên</h1>
      <p className="mt-2 max-w-prose text-body-l text-ink-600">
        Mỗi cộng tác viên có một mã giới thiệu để đưa cho kỹ thuật viên. Kỹ thuật viên nhập mã lúc
        tạo hồ sơ, và mã được chốt tại đó — sau khi tạo thì không đổi được.
      </p>

      <div className="mt-6">
        <CollaboratorManager items={list.items} />
      </div>
    </>
  );
}
