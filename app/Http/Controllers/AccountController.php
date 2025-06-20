<?php

namespace App\Http\Controllers;

use App\EmailVerification;
use App\Follower;
use App\FollowRequest;
use App\Jobs\FollowPipeline\FollowAcceptPipeline;
use App\Jobs\FollowPipeline\FollowPipeline;
use App\Jobs\FollowPipeline\FollowRejectPipeline;
use App\Mail\ConfirmEmail;
use App\Notification;
use App\Profile;
use App\Services\AccountService;
use App\Services\FollowerService;
use App\Services\NotificationService;
use App\Services\RelationshipService;
use App\Services\UserFilterService;
use App\Transformer\Api\Mastodon\v1\AccountTransformer;
use App\User;
use App\UserFilter;
use Auth;
use Cache;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use League\Fractal;
use League\Fractal\Serializer\ArraySerializer;
use Mail;
use PragmaRX\Google2FA\Google2FA;

class AccountController extends Controller
{
    protected $filters = [
        'user.mute',
        'user.block',
    ];

    const FILTER_LIMIT_MUTE_TEXT = 'You cannot mute more than ';

    const FILTER_LIMIT_BLOCK_TEXT = 'You cannot block more than ';

    public function __construct()
    {
        $this->middleware('auth');
    }

    public function notifications(Request $request)
    {
        return view('account.activity');
    }

    public function followingActivity(Request $request)
    {
        $this->validate($request, [
            'page' => 'nullable|min:1|max:3',
            'a' => 'nullable|alpha_dash',
        ]);

        $action = $request->input('a');
        $allowed = ['like', 'follow'];
        $timeago = Carbon::now()->subMonths(3);

        $profile = Auth::user()->profile;
        $following = $profile->following->pluck('id');

        $notifications = Notification::whereIn('actor_id', $following)
            ->whereIn('action', $allowed)
            ->where('actor_id', '<>', $profile->id)
            ->where('profile_id', '<>', $profile->id)
            ->whereDate('created_at', '>', $timeago)
            ->orderBy('notifications.created_at', 'desc')
            ->simplePaginate(30);

        return view('account.following', compact('profile', 'notifications'));
    }

    public function verifyEmail(Request $request)
    {
        $recentSent = EmailVerification::whereUserId(Auth::id())
            ->whereDate('created_at', '>', now()->subHours(12))->count();

        return view('account.verify_email', compact('recentSent'));
    }

    public function sendVerifyEmail(Request $request)
    {
        $recentAttempt = EmailVerification::whereUserId(Auth::id())
            ->whereDate('created_at', '>', now()->subHours(12))->count();

        if ($recentAttempt > 0) {
            return redirect()->back()->with('error', 'A verification email has already been sent recently. Please check your email, or try again later.');
        }

        EmailVerification::whereUserId(Auth::id())->delete();

        $user = User::whereNull('email_verified_at')->find(Auth::id());
        $utoken = Str::uuid().Str::random(mt_rand(5, 9));
        $rtoken = Str::random(mt_rand(64, 70));

        $verify = new EmailVerification;
        $verify->user_id = $user->id;
        $verify->email = $user->email;
        $verify->user_token = $utoken;
        $verify->random_token = $rtoken;
        $verify->save();

        Mail::to($user->email)->send(new ConfirmEmail($verify));

        return redirect()->back()->with('status', 'Verification email sent!');
    }

    public function confirmVerifyEmail(Request $request, $userToken, $randomToken)
    {
        $verify = EmailVerification::where('user_token', $userToken)
            ->where('created_at', '>', now()->subHours(24))
            ->where('random_token', $randomToken)
            ->firstOrFail();

        if (Auth::id() === $verify->user_id && $verify->user_token === $userToken && $verify->random_token === $randomToken) {
            $user = User::find(Auth::id());
            $user->email_verified_at = Carbon::now();
            $user->save();

            return redirect('/');
        } else {
            abort(403);
        }
    }

    public function direct()
    {
        return view('account.direct');
    }

    public function directMessage(Request $request, $id)
    {
        $profile = Profile::where('id', '!=', $request->user()->profile_id)
            ->findOrFail($id);

        return view('account.directmessage', compact('id'));
    }

    public function mute(Request $request)
    {
        $this->validate($request, [
            'type' => 'required|string|in:user',
            'item' => 'required|integer|min:1',
        ]);

        $pid = $request->user()->profile_id;
        $count = UserFilterService::muteCount($pid);
        $maxLimit = (int) config_cache('instance.user_filters.max_user_mutes');
        abort_if($count >= $maxLimit, 422, self::FILTER_LIMIT_MUTE_TEXT.$maxLimit.' accounts');
        if ($count == 0) {
            $filterCount = UserFilter::whereUserId($pid)->count();
            abort_if($filterCount >= $maxLimit, 422, self::FILTER_LIMIT_MUTE_TEXT.$maxLimit.' accounts');
        }
        $type = $request->input('type');
        $item = $request->input('item');
        $action = $type.'.mute';

        if (! in_array($action, $this->filters)) {
            return abort(406);
        }
        $filterable = [];
        switch ($type) {
            case 'user':
                $profile = Profile::findOrFail($item);
                if ($profile->id == $pid) {
                    return abort(403);
                }
                $class = get_class($profile);
                $filterable['id'] = $profile->id;
                $filterable['type'] = $class;
                break;
        }

        $filter = UserFilter::firstOrCreate([
            'user_id' => $pid,
            'filterable_id' => $filterable['id'],
            'filterable_type' => $filterable['type'],
            'filter_type' => 'mute',
        ]);

        UserFilterService::mute($pid, $filterable['id']);
        $res = RelationshipService::refresh($pid, $profile->id);

        if ($request->wantsJson()) {
            return response()->json($res);
        } else {
            return redirect()->back();
        }
    }

    public function unmute(Request $request)
    {
        $this->validate($request, [
            'type' => 'required|string|in:user',
            'item' => 'required|integer|min:1',
        ]);

        $pid = $request->user()->profile_id;
        $type = $request->input('type');
        $item = $request->input('item');
        $action = $type.'.mute';

        if (! in_array($action, $this->filters)) {
            return abort(406);
        }
        $filterable = [];
        switch ($type) {
            case 'user':
                $profile = Profile::findOrFail($item);
                if ($profile->id == $pid) {
                    return abort(403);
                }
                $class = get_class($profile);
                $filterable['id'] = $profile->id;
                $filterable['type'] = $class;
                break;

            default:
                abort(400);
                break;
        }

        $filter = UserFilter::whereUserId($pid)
            ->whereFilterableId($filterable['id'])
            ->whereFilterableType($filterable['type'])
            ->whereFilterType('mute')
            ->first();

        if ($filter) {
            UserFilterService::unmute($pid, $filterable['id']);
            $filter->delete();
        }

        $res = RelationshipService::refresh($pid, $profile->id);

        if ($request->wantsJson()) {
            return response()->json($res);
        } else {
            return redirect()->back();
        }
    }

    public function block(Request $request)
    {
        $this->validate($request, [
            'type' => 'required|string|in:user',
            'item' => 'required|integer|min:1',
        ]);
        $pid = $request->user()->profile_id;
        $count = UserFilterService::blockCount($pid);
        $maxLimit = (int) config_cache('instance.user_filters.max_user_blocks');
        abort_if($count >= $maxLimit, 422, self::FILTER_LIMIT_BLOCK_TEXT.$maxLimit.' accounts');
        if ($count == 0) {
            $filterCount = UserFilter::whereUserId($pid)->whereFilterType('block')->count();
            abort_if($filterCount >= $maxLimit, 422, self::FILTER_LIMIT_BLOCK_TEXT.$maxLimit.' accounts');
        }
        $type = $request->input('type');
        $item = $request->input('item');
        $action = $type.'.block';
        if (! in_array($action, $this->filters)) {
            return abort(406);
        }
        $filterable = [];
        switch ($type) {
            case 'user':
                $profile = Profile::findOrFail($item);
                if ($profile->id == $pid || ($profile->user && $profile->user->is_admin == true)) {
                    return abort(403);
                }
                $class = get_class($profile);
                $filterable['id'] = $profile->id;
                $filterable['type'] = $class;

                $followed = Follower::whereProfileId($profile->id)->whereFollowingId($pid)->first();
                if ($followed) {
                    $followed->delete();
                    $profile->following_count = Follower::whereProfileId($profile->id)->count();
                    $profile->save();
                    $selfProfile = $request->user()->profile;
                    $selfProfile->followers_count = Follower::whereFollowingId($pid)->count();
                    $selfProfile->save();
                    FollowerService::remove($profile->id, $pid);
                    AccountService::del($pid);
                    AccountService::del($profile->id);
                }

                $following = Follower::whereProfileId($pid)->whereFollowingId($profile->id)->first();
                if ($following) {
                    $following->delete();
                    $profile->followers_count = Follower::whereFollowingId($profile->id)->count();
                    $profile->save();
                    $selfProfile = $request->user()->profile;
                    $selfProfile->following_count = Follower::whereProfileId($pid)->count();
                    $selfProfile->save();
                    FollowerService::remove($pid, $profile->pid);
                    AccountService::del($pid);
                    AccountService::del($profile->id);
                }

                Notification::whereProfileId($pid)
                    ->whereActorId($profile->id)
                    ->get()
                    ->map(function ($n) use ($pid) {
                        NotificationService::del($pid, $n['id']);
                        $n->forceDelete();
                    });
                break;
        }

        $filter = UserFilter::firstOrCreate([
            'user_id' => $pid,
            'filterable_id' => $filterable['id'],
            'filterable_type' => $filterable['type'],
            'filter_type' => 'block',
        ]);

        UserFilterService::block($pid, $filterable['id']);
        $res = RelationshipService::refresh($pid, $profile->id);

        if ($request->wantsJson()) {
            return response()->json($res);
        } else {
            return redirect()->back();
        }
    }

    public function unblock(Request $request)
    {
        $this->validate($request, [
            'type' => 'required|string|in:user',
            'item' => 'required|integer|min:1',
        ]);

        $pid = $request->user()->profile_id;
        $type = $request->input('type');
        $item = $request->input('item');
        $action = $type.'.block';
        if (! in_array($action, $this->filters)) {
            return abort(406);
        }
        $filterable = [];
        switch ($type) {
            case 'user':
                $profile = Profile::findOrFail($item);
                if ($profile->id == $pid) {
                    return abort(403);
                }
                $class = get_class($profile);
                $filterable['id'] = $profile->id;
                $filterable['type'] = $class;
                break;

            default:
                abort(400);
                break;
        }

        $filter = UserFilter::whereUserId($pid)
            ->whereFilterableId($filterable['id'])
            ->whereFilterableType($filterable['type'])
            ->whereFilterType('block')
            ->first();

        if ($filter) {
            $filter->delete();
            UserFilterService::unblock($pid, $filterable['id']);
        }

        $res = RelationshipService::refresh($pid, $profile->id);

        if ($request->wantsJson()) {
            return response()->json($res);
        } else {
            return redirect()->back();
        }
    }

    public function followRequests(Request $request)
    {
        $pid = Auth::user()->profile->id;
        $followers = FollowRequest::whereFollowingId($pid)->orderBy('id', 'desc')->whereIsRejected(0)->simplePaginate(10);

        return view('account.follow-requests', compact('followers'));
    }

    public function followRequestsJson(Request $request)
    {
        $pid = Auth::user()->profile_id;
        $followers = FollowRequest::whereFollowingId($pid)->orderBy('id', 'desc')->whereIsRejected(0)->get();
        $res = [
            'count' => $followers->count(),
            'accounts' => $followers->take(10)->map(function ($a) {
                $actor = $a->actor;

                return [
                    'rid' => (string) $a->id,
                    'id' => (string) $actor->id,
                    'username' => $actor->username,
                    'avatar' => $actor->avatarUrl(),
                    'url' => $actor->url(),
                    'local' => $actor->domain == null,
                    'account' => AccountService::get($actor->id),
                ];
            }),
        ];

        return response()->json($res, 200, [], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    }

    public function followRequestHandle(Request $request)
    {
        $this->validate($request, [
            'action' => 'required|string|max:10',
            'id' => 'required|integer|min:1',
        ]);

        $pid = Auth::user()->profile->id;
        $action = $request->input('action') === 'accept' ? 'accept' : 'reject';
        $id = $request->input('id');
        $followRequest = FollowRequest::whereFollowingId($pid)->findOrFail($id);
        $follower = $followRequest->follower;

        switch ($action) {
            case 'accept':
                $follow = new Follower;
                $follow->profile_id = $follower->id;
                $follow->following_id = $pid;
                $follow->save();

                $profile = Profile::findOrFail($pid);
                $profile->followers_count++;
                $profile->save();
                AccountService::del($profile->id);

                $profile = Profile::findOrFail($follower->id);
                $profile->following_count++;
                $profile->save();
                AccountService::del($profile->id);

                if ($follower->domain != null && $follower->private_key === null) {
                    FollowAcceptPipeline::dispatch($followRequest)->onQueue('follow');
                } else {
                    FollowPipeline::dispatch($follow);
                    $followRequest->delete();
                }
                break;

            case 'reject':
                if ($follower->domain != null && $follower->private_key === null) {
                    FollowRejectPipeline::dispatch($followRequest)->onQueue('follow');
                } else {
                    $followRequest->delete();
                }
                break;
        }

        Cache::forget('profile:follower_count:'.$pid);
        Cache::forget('profile:following_count:'.$pid);
        RelationshipService::refresh($pid, $follower->id);

        return response()->json(['msg' => 'success'], 200);
    }

    public function sudoMode(Request $request)
    {
        if ($request->session()->has('sudoModeAttempts') && $request->session()->get('sudoModeAttempts') >= 3) {
            $request->session()->pull('2fa.session.active');
            $request->session()->pull('redirectNext');
            $request->session()->pull('sudoModeAttempts');
            Auth::logout();

            return redirect(route('login'));
        }

        return view('auth.sudo');
    }

    public function sudoModeVerify(Request $request)
    {
        $this->validate($request, [
            'password' => 'required|string|max:500',
            'trustDevice' => 'nullable',
        ]);

        $user = Auth::user();
        $password = $request->input('password');
        $trustDevice = $request->input('trustDevice') == 'on';
        $next = $request->session()->get('redirectNext', '/');
        if ($request->session()->has('sudoModeAttempts')) {
            $count = (int) $request->session()->get('sudoModeAttempts');
            $request->session()->put('sudoModeAttempts', $count + 1);
        } else {
            $request->session()->put('sudoModeAttempts', 1);
        }
        if (password_verify($password, $user->password) === true) {
            $request->session()->put('sudoMode', time());
            if ($trustDevice == true) {
                $request->session()->put('sudoTrustDevice', 1);
            }

            // Fix wrong scheme when using reverse proxy
            if (! str_contains($next, 'https') && config('instance.force_https_urls', true)) {
                $next = Str::of($next)->replace('http', 'https')->toString();
            }

            return redirect($next);
        } else {
            return redirect()
                ->back()
                ->withErrors(['password' => __('auth.failed')]);
        }
    }

    public function twoFactorCheckpoint(Request $request)
    {
        return view('auth.checkpoint');
    }

    public function twoFactorVerify(Request $request)
    {
        $this->validate($request, [
            'code' => 'required|string|max:32',
        ]);
        $user = Auth::user();
        $code = $request->input('code');
        $google2fa = new Google2FA;
        $verify = $google2fa->verifyKey($user->{'2fa_secret'}, $code);
        if ($verify) {
            $request->session()->push('2fa.session.active', true);

            return redirect('/');
        } else {

            if ($this->twoFactorBackupCheck($request, $code, $user)) {
                return redirect('/');
            }

            if ($request->session()->has('2fa.attempts')) {
                $count = (int) $request->session()->get('2fa.attempts');
                if ($count == 3) {
                    Auth::logout();

                    return redirect('/');
                }
                $request->session()->put('2fa.attempts', $count + 1);
            } else {
                $request->session()->put('2fa.attempts', 1);
            }

            return redirect('/i/auth/checkpoint')->withErrors([
                'code' => 'Invalid code',
            ]);
        }
    }

    protected function twoFactorBackupCheck($request, $code, User $user)
    {
        $backupCodes = $user->{'2fa_backup_codes'};
        if ($backupCodes) {
            $codes = json_decode($backupCodes, true);
            foreach ($codes as $c) {
                if (hash_equals($c, $code)) {
                    $codes = array_flatten(array_diff($codes, [$code]));
                    $user->{'2fa_backup_codes'} = json_encode($codes);
                    $user->save();
                    $request->session()->push('2fa.session.active', true);

                    return true;
                }
            }

            return false;
        } else {
            return false;
        }
    }

    public function accountRestored(Request $request) {}

    public function accountMutes(Request $request)
    {
        abort_if(! $request->user(), 403);

        $this->validate($request, [
            'limit' => 'nullable|integer|min:1|max:40',
        ]);

        $user = $request->user();
        $limit = $request->input('limit') ?? 40;

        $mutes = UserFilter::whereUserId($user->profile_id)
            ->whereFilterableType('App\Profile')
            ->whereFilterType('mute')
            ->simplePaginate($limit)
            ->pluck('filterable_id');

        $accounts = Profile::find($mutes);
        $fractal = new Fractal\Manager;
        $fractal->setSerializer(new ArraySerializer);
        $resource = new Fractal\Resource\Collection($accounts, new AccountTransformer);
        $res = $fractal->createData($resource)->toArray();
        $url = $request->url();
        $page = $request->input('page', 1);
        $next = $page < 40 ? $page + 1 : 40;
        $prev = $page > 1 ? $page - 1 : 1;
        $links = '<'.$url.'?page='.$next.'&limit='.$limit.'>; rel="next", <'.$url.'?page='.$prev.'&limit='.$limit.'>; rel="prev"';

        return response()->json($res, 200, ['Link' => $links]);
    }

    public function accountBlocks(Request $request)
    {
        abort_if(! $request->user(), 403);

        $this->validate($request, [
            'limit' => 'nullable|integer|min:1|max:40',
            'page' => 'nullable|integer|min:1|max:10',
        ]);

        $user = $request->user();
        $limit = $request->input('limit') ?? 40;

        $blocked = UserFilter::select('filterable_id', 'filterable_type', 'filter_type', 'user_id')
            ->whereUserId($user->profile_id)
            ->whereFilterableType('App\Profile')
            ->whereFilterType('block')
            ->simplePaginate($limit)
            ->pluck('filterable_id');

        $profiles = Profile::findOrFail($blocked);
        $fractal = new Fractal\Manager;
        $fractal->setSerializer(new ArraySerializer);
        $resource = new Fractal\Resource\Collection($profiles, new AccountTransformer);
        $res = $fractal->createData($resource)->toArray();
        $url = $request->url();
        $page = $request->input('page', 1);
        $next = $page < 40 ? $page + 1 : 40;
        $prev = $page > 1 ? $page - 1 : 1;
        $links = '<'.$url.'?page='.$next.'&limit='.$limit.'>; rel="next", <'.$url.'?page='.$prev.'&limit='.$limit.'>; rel="prev"';

        return response()->json($res, 200, ['Link' => $links]);

    }

    public function accountBlocksV2(Request $request)
    {
        return response()->json(UserFilterService::blocks($request->user()->profile_id), 200, [], JSON_UNESCAPED_SLASHES);
    }

    public function accountMutesV2(Request $request)
    {
        return response()->json(UserFilterService::mutes($request->user()->profile_id), 200, [], JSON_UNESCAPED_SLASHES);
    }

    public function accountFiltersV2(Request $request)
    {
        return response()->json(UserFilterService::filters($request->user()->profile_id), 200, [], JSON_UNESCAPED_SLASHES);
    }
}
