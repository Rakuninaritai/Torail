# main/views_email.py
from django.core.mail import send_mail
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Team, TeamMembership

def _collect_team_recipients(team: Team, exclude_user) -> list[str]:
    qs = (
        TeamMembership.objects
        .filter(team=team)
        .exclude(user=exclude_user)
        .values_list("user__email", flat=True)
    )
    recips = []
    for e in qs:
        if not e:
            continue
        e2 = e.strip()
        if not e2:
            continue
        recips.append(e2)
    return recips

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def email_test(request):
    team_id = request.query_params.get("team_id")
    team = get_object_or_404(Team, pk=team_id, memberships__user=request.user)

    recipients = _collect_team_recipients(team, exclude_user=request.user)
    if not recipients:
        # チームが自分だけだと宛先0件になります
        return Response({"ok": False, "error": "no_recipients"})

    try:
        send_mail(
            subject="Torail: メール通知テスト",
            message=f"Torail テスト: チーム  {team.name}  からのメッセージです。保存すればここに通知が来ます。",
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@example.com"),
            recipient_list=recipients,
            fail_silently=False,
        )
        return Response({"ok": True, "count": len(recipients)})
    except Exception as e:
        return Response({"ok": False, "error": str(e)})
