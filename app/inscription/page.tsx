import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { SiteHeader } from '@/components/SiteHeader';
import { currentUser } from '@/lib/auth';

export const metadata = { title: 'Inscription' };

export default function SignupPage() {
	if (currentUser()) redirect('/portail');
	return (
		<>
			<SiteHeader user={null} />
			<main className="container auth-page">
				<AuthForm mode="signup" />
			</main>
		</>
	);
}
